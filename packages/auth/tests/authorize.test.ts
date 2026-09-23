/**
 * PAS-0204 acceptance tests.
 *
 * Every deny reason is reached by constructing the state that causes it, not
 * by asserting the code has a branch for it. An authorization service that
 * returns DENY for the wrong reason is one whose audit record is fiction, and
 * one whose next change will move a check past the wrong guard.
 *
 * The compile-time guarantees are asserted with `@ts-expect-error`, which
 * fails the **typecheck** if forging a grant ever starts being allowed.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { query, closePool, migrate } from '@pas/database';
import { generateId } from '@pas/domain';
import { now, AuthorizationError } from '@pas/contracts';
import { resolve } from 'node:path';
import {
  authorize,
  requireCapability,
  grantDecision,
  isAllowed,
  actorForUser,
  inAccount,
  ANONYMOUS,
  PLATFORM_SCOPE,
  platformAccountId,
  resetPlatformAccountCache,
  type Grant,
  type Actor,
} from '../src/index.js';

const MIGRATIONS = resolve(import.meta.dirname, '../../../migrations');

interface Fixture {
  userId: string;
  accountId: string;
  membershipId: string;
  actor: Actor;
}

async function makeUser(status = 'ACTIVE'): Promise<string> {
  const id = generateId();
  await query(
    `insert into users (id, email, status, created_at, updated_at) values ($1, $2, $3, $4, $4)`,
    [id, `u-${id}@example.com`, status, now()],
  );
  return id;
}

async function makeAccount(type = 'ORGANIZATION', status = 'ACTIVE'): Promise<string> {
  const id = generateId();
  await query(
    `insert into accounts (id, account_type, display_name, status, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $5)`,
    [id, type, `Account ${id.slice(0, 8)}`, status, now()],
  );
  return id;
}

async function makeMembership(
  accountId: string,
  userId: string,
  status = 'ACTIVE',
): Promise<string> {
  const id = generateId();
  await query(
    `insert into account_memberships (id, account_id, user_id, status, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $5)`,
    [id, accountId, userId, status, now()],
  );
  return id;
}

async function grantRole(membershipId: string, role: string): Promise<void> {
  await query(
    `insert into membership_roles (id, account_membership_id, role_name, created_at, updated_at)
     values ($1, $2, $3, $4, $4)`,
    [generateId(), membershipId, role, now()],
  );
}

async function override(
  membershipId: string,
  capability: string,
  effect: 'ALLOW' | 'DENY',
  reason = 'test',
): Promise<void> {
  await query(
    `insert into capability_overrides
       (id, account_membership_id, capability_name, effect, reason, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $6)`,
    [generateId(), membershipId, capability, effect, reason, now()],
  );
}

/** A user who owns an active organization account. */
async function owner(): Promise<Fixture> {
  const userId = await makeUser();
  const accountId = await makeAccount();
  const membershipId = await makeMembership(accountId, userId);
  await grantRole(membershipId, 'OWNER');
  return { userId, accountId, membershipId, actor: actorForUser(userId) };
}

beforeAll(async () => {
  await query('drop schema public cascade');
  await query('create schema public');
  await migrate({ directory: MIGRATIONS });
  resetPlatformAccountCache();
}, 60_000);

beforeEach(async () => {
  await query(
    `truncate table capability_overrides, membership_roles, authentication_events,
       sessions, user_credentials, account_memberships restart identity cascade`,
  );
  await query(`delete from accounts where account_type <> 'PLATFORM'`);
  await query(`delete from users`);
});

afterAll(async () => {
  await closePool();
});

describe('ALLOW', () => {
  it('allows a capability a role grants', async () => {
    const { actor, accountId, membershipId } = await owner();
    const decision = await authorize(actor, 'claim.create', inAccount(accountId));

    expect(decision.decision).toBe('ALLOW');
    expect(decision.reason).toBe('ROLE_GRANT');
    expect(decision.membershipId).toBe(membershipId);
    expect(decision.accountId).toBe(accountId);
    expect(isAllowed(decision)).toBe(true);
  });

  it('allows a capability only an override grants', async () => {
    // The COLLABORATOR case PAS-0203 designed for: private read is withheld by
    // the role and granted per-membership with a reason attached.
    const userId = await makeUser();
    const accountId = await makeAccount();
    const membershipId = await makeMembership(accountId, userId);
    await grantRole(membershipId, 'COLLABORATOR');
    const actor = actorForUser(userId);

    expect((await authorize(actor, 'authority.record.read_private', inAccount(accountId))).reason)
      .toBe('NO_CAPABILITY');

    await override(membershipId, 'authority.record.read_private', 'ALLOW', 'incident 42');

    const after = await authorize(actor, 'authority.record.read_private', inAccount(accountId));
    expect(after.decision).toBe('ALLOW');
    expect(after.reason).toBe('EXPLICIT_ALLOW');
  });

  it('allows a platform capability through a platform membership', async () => {
    const userId = await makeUser();
    const membershipId = await makeMembership(await platformAccountId(), userId);
    await grantRole(membershipId, 'PLATFORM_ADMIN');

    const decision = await authorize(actorForUser(userId), 'platform.admin', PLATFORM_SCOPE);
    expect(decision.decision).toBe('ALLOW');
    expect(decision.scope).toBe('PLATFORM');
    expect(decision.accountId).toBe(await platformAccountId());
  });
});

describe('every DENY reason is reachable, and is the right one', () => {
  it('ANONYMOUS — without touching the database', async () => {
    const decision = await authorize(ANONYMOUS, 'claim.create', inAccount(generateId()));
    expect(decision).toMatchObject({ decision: 'DENY', reason: 'ANONYMOUS' });
    // No membership was looked up, so nothing about the account was revealed
    // and nothing was spent on an unauthenticated caller.
    expect(decision.membershipId).toBeUndefined();
  });

  it('UNKNOWN_CAPABILITY — fails closed on a name outside the namespace', async () => {
    const { actor, accountId } = await owner();
    // The typo that would otherwise be looked up, match nothing, and report
    // NO_CAPABILITY — indistinguishable from a real permissions problem.
    const decision = await authorize(actor, 'claim.creat', inAccount(accountId));
    expect(decision).toMatchObject({ decision: 'DENY', reason: 'UNKNOWN_CAPABILITY' });
  });

  it('NO_MEMBERSHIP — a user with no membership in that account', async () => {
    const { accountId } = await owner();
    const stranger = actorForUser(await makeUser());
    expect(await authorize(stranger, 'claim.create', inAccount(accountId))).toMatchObject({
      decision: 'DENY',
      reason: 'NO_MEMBERSHIP',
    });
  });

  it('NO_MEMBERSHIP — and does not distinguish a nonexistent account', async () => {
    const { actor } = await owner();
    // Distinguishing would confirm whether an account exists.
    expect(await authorize(actor, 'claim.create', inAccount(generateId()))).toMatchObject({
      reason: 'NO_MEMBERSHIP',
    });
  });

  it('USER_NOT_ACTIVE', async () => {
    const { actor, accountId, userId } = await owner();
    await query(`update users set status = 'SUSPENDED' where id = $1`, [userId]);
    expect(await authorize(actor, 'claim.create', inAccount(accountId))).toMatchObject({
      decision: 'DENY',
      reason: 'USER_NOT_ACTIVE',
    });
  });

  it('ACCOUNT_NOT_ACTIVE', async () => {
    const { actor, accountId } = await owner();
    await query(`update accounts set status = 'SUSPENDED' where id = $1`, [accountId]);
    expect(await authorize(actor, 'claim.create', inAccount(accountId))).toMatchObject({
      decision: 'DENY',
      reason: 'ACCOUNT_NOT_ACTIVE',
    });
  });

  it('MEMBERSHIP_NOT_ACTIVE', async () => {
    const { actor, accountId, membershipId } = await owner();
    await query(`update account_memberships set status = 'REVOKED' where id = $1`, [membershipId]);
    expect(await authorize(actor, 'claim.create', inAccount(accountId))).toMatchObject({
      decision: 'DENY',
      reason: 'MEMBERSHIP_NOT_ACTIVE',
    });
  });

  it('NO_CAPABILITY — a membership in good standing that simply lacks it', async () => {
    const { actor, accountId } = await owner();
    // PAS-0203: no role holds claim.approve.
    expect(await authorize(actor, 'claim.approve', inAccount(accountId))).toMatchObject({
      decision: 'DENY',
      reason: 'NO_CAPABILITY',
    });
  });

  it('EXPLICIT_DENY — an override beats the role that grants it', async () => {
    const { actor, accountId, membershipId } = await owner();
    expect((await authorize(actor, 'claim.create', inAccount(accountId))).reason).toBe('ROLE_GRANT');

    await override(membershipId, 'claim.create', 'DENY', 'under investigation');

    expect(await authorize(actor, 'claim.create', inAccount(accountId))).toMatchObject({
      decision: 'DENY',
      reason: 'EXPLICIT_DENY',
    });
  });
});

describe('status is checked before an ALLOW override', () => {
  /**
   * An override says which *capability* a membership has. It says nothing
   * about whether the principal is live. A suspended user holding an ALLOW
   * override must still be refused, or suspension is not suspension.
   */
  it.each([
    ['user', `update users set status = 'SUSPENDED' where id = $1`, 'USER_NOT_ACTIVE'],
    ['account', `update accounts set status = 'SUSPENDED' where id = $1`, 'ACCOUNT_NOT_ACTIVE'],
    ['membership', `update account_memberships set status = 'REVOKED' where id = $1`, 'MEMBERSHIP_NOT_ACTIVE'],
  ])('a suspended %s is refused despite an ALLOW override', async (target, sql, reason) => {
    const fixture = await owner();
    await override(fixture.membershipId, 'audit.read', 'ALLOW', 'test');

    // Held, before the suspension.
    expect((await authorize(fixture.actor, 'audit.read', inAccount(fixture.accountId))).decision)
      .toBe('ALLOW');

    const id =
      target === 'user' ? fixture.userId
      : target === 'account' ? fixture.accountId
      : fixture.membershipId;
    await query(sql, [id]);

    expect(await authorize(fixture.actor, 'audit.read', inAccount(fixture.accountId))).toMatchObject({
      decision: 'DENY',
      reason,
    });
  });
});

describe('authority does not leak across accounts — ADR-007', () => {
  /**
   * The reason overrides are grained to membership and not to user. A row
   * keyed by `user_id` would grant the capability in every account the user
   * belongs to.
   */
  it('a role in one account grants nothing in another', async () => {
    const userId = await makeUser();
    const [a, b] = [await makeAccount(), await makeAccount()];
    const membershipA = await makeMembership(a, userId);
    await makeMembership(b, userId);
    await grantRole(membershipA, 'ORGANIZATION_ADMIN');
    const actor = actorForUser(userId);

    expect((await authorize(actor, 'organization.manage', inAccount(a))).decision).toBe('ALLOW');
    expect(await authorize(actor, 'organization.manage', inAccount(b))).toMatchObject({
      decision: 'DENY',
      reason: 'NO_CAPABILITY',
    });
  });

  it('an override in one account does not reach another', async () => {
    const userId = await makeUser();
    const [a, b] = [await makeAccount(), await makeAccount()];
    const membershipA = await makeMembership(a, userId);
    await makeMembership(b, userId);
    await override(membershipA, 'authority.record.read_private', 'ALLOW', 'support ticket');
    const actor = actorForUser(userId);

    expect((await authorize(actor, 'authority.record.read_private', inAccount(a))).decision)
      .toBe('ALLOW');
    expect((await authorize(actor, 'authority.record.read_private', inAccount(b))).decision)
      .toBe('DENY');
  });

  /**
   * The MasterAdminView answer, enforced rather than described. PAS-0203 gave
   * PLATFORM_ADMIN three capabilities and no reach into records; this is that
   * decision actually refusing.
   */
  it('a platform administrator cannot read a private record in someone\'s account', async () => {
    const adminId = await makeUser();
    const adminMembership = await makeMembership(await platformAccountId(), adminId);
    await grantRole(adminMembership, 'PLATFORM_ADMIN');
    const admin = actorForUser(adminId);

    const victim = await owner();

    expect((await authorize(admin, 'platform.admin', PLATFORM_SCOPE)).decision).toBe('ALLOW');

    // Being an administrator is not authority over anyone's material.
    expect(await authorize(admin, 'authority.record.read_private', inAccount(victim.accountId)))
      .toMatchObject({ decision: 'DENY', reason: 'NO_MEMBERSHIP' });
  });

  it('a platform capability asked for in an ordinary account is refused', async () => {
    const { actor, accountId } = await owner();
    expect(await authorize(actor, 'platform.admin', inAccount(accountId))).toMatchObject({
      decision: 'DENY',
      reason: 'NO_CAPABILITY',
    });
  });
});

describe('requireCapability — the obligation', () => {
  it('returns a grant on ALLOW', async () => {
    const { actor, accountId } = await owner();
    const grant = await requireCapability(actor, 'claim.create', inAccount(accountId));

    expect(grant.capability).toBe('claim.create');
    expect(grantDecision(grant).reason).toBe('ROLE_GRANT');
  });

  it('throws AuthorizationError on DENY', async () => {
    const { actor, accountId } = await owner();
    await expect(
      requireCapability(actor, 'claim.approve', inAccount(accountId)),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  /**
   * The reason distinguishes "you are not a member of that account" from "you
   * were specifically denied", which tells a prober about an account's
   * structure and membership. One refusal goes to the caller.
   */
  it('carries the capability but never the reason', async () => {
    const { accountId } = await owner();
    const stranger = actorForUser(await makeUser());

    try {
      await requireCapability(stranger, 'claim.create', inAccount(accountId));
      expect.unreachable('should have thrown');
    } catch (error) {
      const thrown = error as AuthorizationError;
      expect(thrown.capability).toBe('claim.create');

      const rendered = `${thrown.message} ${JSON.stringify(thrown.details ?? {})}`;
      for (const leak of ['NO_MEMBERSHIP', 'EXPLICIT_DENY', 'NOT_ACTIVE', accountId]) {
        expect(rendered, leak).not.toContain(leak);
      }
    }
  });

  it('cannot be satisfied without calling it — a grant cannot be forged', async () => {
    const { actor, accountId } = await owner();

    async function createClaim(grant: Grant<'claim.create'>): Promise<string> {
      return grant.capability;
    }

    const real = await requireCapability(actor, 'claim.create', inAccount(accountId));
    expect(await createClaim(real)).toBe('claim.create');

    // @ts-expect-error a plain object is not a Grant — the brand is unexported
    await expect(createClaim({ capability: 'claim.create', decision: real.decision })).resolves.toBeDefined();

    const other = await requireCapability(actor, 'source.create', inAccount(accountId));
    // @ts-expect-error a grant for one capability is not a grant for another
    await expect(createClaim(other)).resolves.toBeDefined();
  });
});

describe('the decision carries what an audit record needs', () => {
  it('names the capability, the actor, the scope, the account and the membership', async () => {
    const { actor, accountId, membershipId, userId } = await owner();
    const decision = await authorize(actor, 'claim.create', inAccount(accountId));

    expect(decision).toMatchObject({
      decision: 'ALLOW',
      capability: 'claim.create',
      reason: 'ROLE_GRANT',
      scope: 'ACCOUNT',
      accountId,
      membershipId,
    });
    expect(decision.actor).toEqual({ kind: 'USER', userId });
  });

  it('records the capability even when the name was not recognised', async () => {
    const { actor, accountId } = await owner();
    const decision = await authorize(actor, 'made.up.capability', inAccount(accountId));
    // So an audit trail shows what was attempted, not just that something was.
    expect(decision.capability).toBe('made.up.capability');
  });
});

describe('a failure is not a refusal', () => {
  /**
   * A 403 for a database outage sends the on-call engineer to debug
   * permissions and hides the outage behind a plausible answer. Fail closed
   * means "no decision is an allow", not "every failure is a refusal".
   */
  it('propagates a database failure rather than returning DENY', async () => {
    const { actor, accountId } = await owner();
    await query(`drop table membership_roles`);

    await expect(authorize(actor, 'claim.create', inAccount(accountId))).rejects.toThrow();

    // Restore for the suites that follow.
    await query('drop schema public cascade');
    await query('create schema public');
    await migrate({ directory: MIGRATIONS });
    resetPlatformAccountCache();
  }, 30_000);
});
