/**
 * PAS-0203 acceptance tests.
 *
 * Two things are worth testing here and they are both about *absence*: that
 * the seeded namespace is exactly the specification's, with nothing quietly
 * added, and that the capabilities no role holds are exactly the ones that
 * were meant to be withheld.
 *
 * A registry test that only checks "the rows exist" would pass just as well
 * against a registry that granted everything to everyone.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { query, closePool, migrate, withTransaction } from '@pas/database';
import { generateId } from '@pas/domain';
import { now } from '@pas/contracts';
import { resolve } from 'node:path';
import {
  CAPABILITIES,
  ROLES,
  UNHELD_CAPABILITIES,
  isCapability,
  platformAccountId,
  resetPlatformAccountCache,
} from '../src/index.js';

const MIGRATIONS = resolve(import.meta.dirname, '../../../migrations');

beforeAll(async () => {
  await query('drop schema public cascade');
  await query('create schema public');
  await migrate({ directory: MIGRATIONS });
  resetPlatformAccountCache();
}, 60_000);

beforeEach(async () => {
  // Catalogue-driven, per CLAUDE.md §5 — and note what is NOT truncated:
  // capabilities, roles and role_capabilities are seed data, not fixtures.
  await query(
    `truncate table capability_overrides, membership_roles,
       authentication_events, sessions, user_credentials, account_memberships
     restart identity cascade`,
  );
  // Accounts and users cannot be truncated wholesale — the platform account is
  // seed data too.
  await query(`delete from accounts where account_type <> 'PLATFORM'`);
  await query(`delete from users`);
});

afterAll(async () => {
  await closePool();
});

describe('the seeded namespace is the specification, exactly', () => {
  /**
   * The constant in `namespace.ts` and the `capabilities` table are two copies
   * of one list. Callers need a name the compiler checks; the database needs a
   * foreign key so a grant naming a capability that does not exist is refused
   * at write time rather than silently never matching at authorization time.
   *
   * Two copies drift. This is what stops them.
   */
  it('seeds exactly the capabilities the code declares', async () => {
    const { rows } = await query<{ name: string }>(
      `select name from capabilities order by name`,
    );
    expect(rows.map((r) => r.name)).toEqual([...CAPABILITIES].sort());
  });

  it('seeds the thirty capabilities of Part I §7', async () => {
    const { rows } = await query<{ count: string }>(`select count(*) from capabilities`);
    expect(rows[0].count).toBe('30');
    expect(CAPABILITIES).toHaveLength(30);
  });

  it('seeds exactly the roles the code declares', async () => {
    const { rows } = await query<{ name: string }>(`select name from roles order by name`);
    expect(rows.map((r) => r.name)).toEqual([...ROLES].sort());
  });

  it('rejects a capability name outside the namespace', () => {
    expect(isCapability('authority.entity.read')).toBe(true);
    // The typo that would otherwise compile, always deny, and read as a
    // permissions bug.
    expect(isCapability('authorty.entity.read')).toBe(false);
    expect(isCapability('platform.admin ')).toBe(false);
    expect(isCapability('')).toBe(false);
    expect(isCapability(null)).toBe(false);
  });
});

describe('no role can authorize its own claims — INV-27, INV-12, SUP-12', () => {
  /**
   * The central assertion of this ticket.
   *
   * SUP-12 is what happens without this separation: in the baseline, typing a
   * sentence into a modal produces `PUBLISH_READY`, `PUBLIC`,
   * `confidenceScore: 100` authority. Granting OWNER the power to approve its
   * own claims reproduces exactly that at the authorization layer, where it is
   * far harder to see.
   */
  it('grants the review and approval capabilities to nobody', async () => {
    const { rows } = await query<{ name: string }>(
      `select c.name from capabilities c
        where not exists (
          select 1 from role_capabilities rc where rc.capability_name = c.name
        )
        order by c.name`,
    );
    // Exactly these, no more and no fewer. More means a gate has silently
    // become unreachable; fewer means one has been handed to someone.
    expect(rows.map((r) => r.name)).toEqual([...UNHELD_CAPABILITIES].sort());
  });

  it.each(['OWNER', 'COLLABORATOR', 'ORGANIZATION_ADMIN', 'PLATFORM_ADMIN'])(
    '%s holds none of them',
    async (role) => {
      const { rows } = await query<{ capability_name: string }>(
        `select capability_name from role_capabilities
          where role_name = $1 and capability_name = any($2)`,
        [role, [...UNHELD_CAPABILITIES]],
      );
      expect(rows).toEqual([]);
    },
  );
});

describe('the role grants are what they are meant to be', () => {
  async function capabilitiesOf(role: string): Promise<string[]> {
    const { rows } = await query<{ capability_name: string }>(
      `select capability_name from role_capabilities where role_name = $1 order by 1`,
      [role],
    );
    return rows.map((r) => r.capability_name);
  }

  it('lets an OWNER publish, because a PAS its owner cannot publish is not a product', async () => {
    const owner = await capabilitiesOf('OWNER');
    expect(owner).toContain('publication.publish');
    expect(owner).toContain('publication.unpublish');
    // The separation is preserved elsewhere and more precisely: INV-3 makes
    // the Published PAS a projection, so publishing exposes only what has
    // already passed its gates.
    expect(owner).not.toContain('composition.approve');
    expect(owner).not.toContain('representation.approve');
  });

  it('withholds private read and deletion from a COLLABORATOR', async () => {
    const collaborator = await capabilitiesOf('COLLABORATOR');
    expect(collaborator).toContain('authority.record.read');
    // Not by accident — a collaborator who needs private read gets an
    // explicit override with a reason attached, which is the case
    // capability_overrides exists for.
    expect(collaborator).not.toContain('authority.record.read_private');
    expect(collaborator).not.toContain('source.delete');
    expect(collaborator).not.toContain('publication.publish');
    expect(collaborator).not.toContain('relationship.manage');
  });

  /**
   * The direct answer to `MasterAdminView`'s unguarded god view
   * (`docs/RECONCILIATION.md` Part 7). A platform administrator is not thereby
   * authorized over every account's private records.
   */
  it('gives PLATFORM_ADMIN no reach into anyone\'s records', async () => {
    expect(await capabilitiesOf('PLATFORM_ADMIN')).toEqual([
      'audit.read',
      'governance.admin',
      'platform.admin',
    ]);
  });

  it('gives ORGANIZATION_ADMIN organization.manage and nobody else', async () => {
    const { rows } = await query<{ role_name: string }>(
      `select role_name from role_capabilities where capability_name = 'organization.manage'`,
    );
    expect(rows.map((r) => r.role_name)).toEqual(['ORGANIZATION_ADMIN']);
  });
});

describe('the platform is an account — ADR-007', () => {
  it('is seeded exactly once and resolvable by type', async () => {
    const id = await platformAccountId();
    const { rows } = await query<{ id: string; display_name: string }>(
      `select id, display_name from accounts where account_type = 'PLATFORM'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(id);
  });

  it('refuses a second platform account', async () => {
    await expect(
      query(
        `insert into accounts (id, account_type, display_name, created_at, updated_at)
         values ($1, 'PLATFORM', 'Impostor', $2, $2)`,
        [generateId(), now()],
      ),
    ).rejects.toThrow();
  });

  it('carries no semantic identifier', async () => {
    // A constant like 0000…0001 would be a semantic identifier, which PAS-0103
    // forbids. Resolution is by type, of which there is provably one.
    const id = await platformAccountId();
    expect(id).not.toMatch(/^0{8}-/);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  /**
   * The identifier is cached for the process lifetime, which is sound rather
   * than a shortcut: migration 0003 creates the row and a unique index forbids
   * a second, so it cannot change under a running process.
   *
   * Asserted by making the row disappear underneath a warm cache — inside a
   * transaction that rolls back, so the seed data survives the test.
   */
  it('resolves once and does not look again', async () => {
    const id = await platformAccountId();

    await expect(
      withTransaction(async (tx) => {
        await query(`delete from accounts where account_type = 'PLATFORM'`, [], { client: tx });

        // Warm: returns without looking, so the missing row is invisible.
        expect(await platformAccountId(tx)).toBe(id);

        // Cold: it must look, and find nothing.
        resetPlatformAccountCache();
        await expect(platformAccountId(tx)).rejects.toThrow(/exactly one PLATFORM account/i);

        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    resetPlatformAccountCache();
    expect(await platformAccountId()).toBe(id);
  });

  it('holds platform administrators through an ordinary membership', async () => {
    // The point of ADR-007: platform.admin cannot be held without a row
    // somebody can list, audit and revoke.
    const platform = await platformAccountId();
    const userId = generateId();
    const at = now();
    await query(
      `insert into users (id, email, created_at, updated_at) values ($1, $2, $3, $3)`,
      [userId, `admin-${userId}@example.com`, at],
    );
    const membershipId = generateId();
    await query(
      `insert into account_memberships (id, account_id, user_id, created_at, updated_at)
       values ($1, $2, $3, $4, $4)`,
      [membershipId, platform, userId, at],
    );
    await query(
      `insert into membership_roles (id, account_membership_id, role_name, created_at, updated_at)
       values ($1, $2, 'PLATFORM_ADMIN', $3, $3)`,
      [generateId(), membershipId, at],
    );

    const { rows } = await query<{ user_id: string }>(
      `select m.user_id from membership_roles mr
         join account_memberships m on m.id = mr.account_membership_id
         join accounts a on a.id = m.account_id
        where mr.role_name = 'PLATFORM_ADMIN' and a.account_type = 'PLATFORM'`,
    );
    expect(rows.map((r) => r.user_id)).toEqual([userId]);
  });
});

describe('the registry refuses what it must', () => {
  async function fixtureMembership(): Promise<string> {
    const at = now();
    const userId = generateId();
    const accountId = generateId();
    const membershipId = generateId();
    await query(
      `insert into users (id, email, created_at, updated_at) values ($1, $2, $3, $3)`,
      [userId, `u-${userId}@example.com`, at],
    );
    await query(
      `insert into accounts (id, account_type, display_name, created_at, updated_at)
       values ($1, 'ORGANIZATION', 'Fixture Org', $2, $2)`,
      [accountId, at],
    );
    await query(
      `insert into account_memberships (id, account_id, user_id, created_at, updated_at)
       values ($1, $2, $3, $4, $4)`,
      [membershipId, accountId, userId, at],
    );
    return membershipId;
  }

  it('refuses a role grant naming a capability that does not exist', async () => {
    // Why capabilities are a table and not an enum in code: the typo is
    // refused at write time instead of silently never matching at
    // authorization time.
    await expect(
      query(
        `insert into role_capabilities (role_name, capability_name, created_at)
         values ('OWNER', 'authority.entity.destroy', $1)`,
        [now()],
      ),
    ).rejects.toThrow();
  });

  it('refuses an override naming a capability that does not exist', async () => {
    const membershipId = await fixtureMembership();
    await expect(
      query(
        `insert into capability_overrides
           (id, account_membership_id, capability_name, effect, reason, created_at, updated_at)
         values ($1, $2, 'platform.root', 'ALLOW', 'test', $3, $3)`,
        [generateId(), membershipId, now()],
      ),
    ).rejects.toThrow();
  });

  it('refuses an override with no reason', async () => {
    const membershipId = await fixtureMembership();
    // NULL as well as blank. The mutation that made this column nullable
    // survived the first sweep because only the blank cases were covered, and
    // a NULL reason is the more likely one — it is what an INSERT that simply
    // omits the column produces.
    await expect(
      query(
        `insert into capability_overrides
           (id, account_membership_id, capability_name, effect, created_at, updated_at)
         values ($1, $2, 'audit.read', 'ALLOW', $3, $3)`,
        [generateId(), membershipId, now()],
      ),
    ).rejects.toThrow();

    for (const reason of ['', '   ']) {
      await expect(
        query(
          `insert into capability_overrides
             (id, account_membership_id, capability_name, effect, reason, created_at, updated_at)
           values ($1, $2, 'audit.read', 'ALLOW', $3, $4, $4)`,
          [generateId(), membershipId, reason, now()],
        ),
        JSON.stringify(reason),
      ).rejects.toThrow();
    }
  });

  it('refuses both ALLOW and DENY for one membership and capability', async () => {
    const membershipId = await fixtureMembership();
    const at = now();
    await query(
      `insert into capability_overrides
         (id, account_membership_id, capability_name, effect, reason, created_at, updated_at)
       values ($1, $2, 'audit.read', 'ALLOW', 'incident 42', $3, $3)`,
      [generateId(), membershipId, at],
    );
    // Resolution order is then a rule about roles versus overrides only, and
    // never about which override wins.
    await expect(
      query(
        `insert into capability_overrides
           (id, account_membership_id, capability_name, effect, reason, created_at, updated_at)
         values ($1, $2, 'audit.read', 'DENY', 'reversed', $3, $3)`,
        [generateId(), membershipId, at],
      ),
    ).rejects.toThrow();
  });

  it('refuses an unknown override effect', async () => {
    const membershipId = await fixtureMembership();
    await expect(
      query(
        `insert into capability_overrides
           (id, account_membership_id, capability_name, effect, reason, created_at, updated_at)
         values ($1, $2, 'audit.read', 'MAYBE', 'test', $3, $3)`,
        [generateId(), membershipId, now()],
      ),
    ).rejects.toThrow();
  });

  it('refuses the same role granted twice to one membership', async () => {
    const membershipId = await fixtureMembership();
    const at = now();
    await query(
      `insert into membership_roles (id, account_membership_id, role_name, created_at, updated_at)
       values ($1, $2, 'OWNER', $3, $3)`,
      [generateId(), membershipId, at],
    );
    await expect(
      query(
        `insert into membership_roles (id, account_membership_id, role_name, created_at, updated_at)
         values ($1, $2, 'OWNER', $3, $3)`,
        [generateId(), membershipId, at],
      ),
    ).rejects.toThrow();
  });

  it('refuses a role grant on a membership that does not exist', async () => {
    await expect(
      query(
        `insert into membership_roles (id, account_membership_id, role_name, created_at, updated_at)
         values ($1, $2, 'OWNER', $3, $3)`,
        [generateId(), generateId(), now()],
      ),
    ).rejects.toThrow();
  });

  it('refuses deleting a capability that a role still grants', async () => {
    // Seed data is referenced, so it cannot be removed by accident.
    await expect(
      query(`delete from capabilities where name = 'platform.admin'`),
    ).rejects.toThrow();
  });
});
