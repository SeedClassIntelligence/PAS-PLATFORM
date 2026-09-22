/**
 * PAS-0202 — authentication and sessions, against a real PostgreSQL.
 *
 * The properties worth testing here are negatives: what the login flow must
 * *not* reveal, what the database must *not* hold, and what a rejected session
 * must *not* still permit. A happy-path login proves almost none of them.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { query, closePool, migrate } from '@pas/database';
import { generateId } from '@pas/domain';
import { now } from '@pas/contracts';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  login,
  setPassword,
  issueSession,
  resolveSession,
  revokeSession,
  revokeAllSessionsForUser,
  hashSessionToken,
  newSessionToken,
  hashPassword,
} from '../src/index.js';

const PASSWORD = 'correct horse battery staple';
const MIGRATIONS = resolve(import.meta.dirname, '../../../migrations');

async function createUser(email: string, status = 'ACTIVE'): Promise<string> {
  const id = generateId();
  const at = now();
  await query(
    `insert into users (id, email, status, created_at, updated_at) values ($1, $2, $3, $4, $4)`,
    [id, email, status, at],
  );
  return id;
}

/**
 * Backdates a whole session row consistently.
 *
 * Setting `last_seen_at` or `expires_at` alone produces a row the schema
 * refuses — a session seen before it existed, or expiring before it was
 * created — which is PAS-0201's monotonicity constraints doing their job even
 * against a test. An aged session is aged in every column.
 */
async function ageSession(
  id: string,
  minutes: { created: number; expiresIn: number; lastSeen: number },
): Promise<void> {
  const at = (ago: number) => new Date(Date.now() - ago * 60_000).toISOString();
  await query(
    `update sessions set created_at = $2, updated_at = $2, expires_at = $3, last_seen_at = $4
      where id = $1`,
    [id, at(minutes.created), at(-minutes.expiresIn), at(minutes.lastSeen)],
  );
}

async function userWithPassword(email: string, password = PASSWORD): Promise<string> {
  const id = await createUser(email);
  await setPassword(id, password);
  return id;
}

/**
 * Starts from a known state rather than from whatever the previous suite left.
 *
 * `pas_test` is shared, and `packages/database/tests/migrate.test.ts`
 * legitimately destroys `schema_migrations` — the ledger is its subject. A
 * suite that assumes a consistent schema *and* ledger on a shared database is
 * assuming something no other suite is obliged to preserve, and this one
 * failed in CI for exactly that reason. Resetting first costs one statement
 * and removes the dependency on test ordering entirely.
 */
beforeAll(async () => {
  await query('drop schema public cascade');
  await query('create schema public');
  await migrate({ directory: MIGRATIONS });
}, 60_000);

/**
 * Empties every table except the migration ledger, computed from the catalogue
 * rather than listed. The equivalent list in the PAS-0201 integration suite
 * broke the moment this build added tables referencing `users`; a list is a
 * thing every future migration has to remember to edit.
 */
beforeEach(async () => {
  const { rows } = await query<{ tablename: string }>(
    `select tablename from pg_tables
      where schemaname = 'public' and tablename <> 'schema_migrations'`,
  );
  if (rows.length === 0) return;
  await query(
    `truncate table ${rows.map((r) => `"${r.tablename}"`).join(', ')} restart identity cascade`,
  );
});

afterAll(async () => {
  await closePool();
});

describe('login', () => {
  it('authenticates a correct address and password', async () => {
    const userId = await userWithPassword('bob@example.com');
    const result = await login('bob@example.com', PASSWORD);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.userId).toBe(userId);
    expect(result.session.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it('accepts the address in any case, matching the stored normalisation', async () => {
    await userWithPassword('Bob@Example.COM');
    for (const spelling of ['bob@example.com', 'BOB@EXAMPLE.COM', '  Bob@Example.com  ']) {
      const result = await login(spelling, PASSWORD);
      expect(result.ok, spelling).toBe(true);
    }
  });

  it('rejects a wrong password', async () => {
    await userWithPassword('bob@example.com');
    const result = await login('bob@example.com', 'wrong password entirely');
    expect(result).toEqual({ ok: false, reason: 'INVALID_CREDENTIALS' });
  });
});

describe('login reveals nothing about which accounts exist', () => {
  /**
   * A login form that distinguishes "no such user" from "wrong password" is an
   * account enumeration oracle, and the addresses it confirms are the input to
   * every credential-stuffing run that follows.
   */
  it('returns one indistinguishable failure for every unsuccessful case', async () => {
    await userWithPassword('exists@example.com');
    await createUser('no-credential@example.com'); // exists, never set a password
    await createUser('suspended@example.com', 'SUSPENDED');
    await setPassword(
      (await query<{ id: string }>(`select id from users where email = $1`, ['suspended@example.com'])).rows[0].id,
      PASSWORD,
    );

    const outcomes = await Promise.all([
      login('nobody@example.com', PASSWORD),
      login('exists@example.com', 'wrong password'),
      login('no-credential@example.com', PASSWORD),
      login('suspended@example.com', PASSWORD),
      login('', PASSWORD),
    ]);

    for (const outcome of outcomes) {
      expect(outcome).toEqual({ ok: false, reason: 'INVALID_CREDENTIALS' });
    }
  });

  /**
   * Saying it is not enough — timing says it too. Rejecting an unknown address
   * early returns in microseconds while a real one spends the full KDF, and
   * that gap is measurable over the internet.
   *
   * Measured as a ratio rather than an absolute, because absolute timings on
   * shared CI hardware are noise. The assertion is deliberately loose: a
   * *skipped* hash is two or three orders of magnitude faster, not 3x.
   */
  it('spends comparable time on an unknown address as on a real one', async () => {
    await userWithPassword('exists@example.com');

    // Warm: first call builds the decoy hash and fills any caches.
    await login('warmup@example.com', PASSWORD);
    await login('exists@example.com', 'wrong');

    const time = async (fn: () => Promise<unknown>): Promise<number> => {
      const samples: number[] = [];
      for (let i = 0; i < 5; i += 1) {
        const t0 = process.hrtime.bigint();
        await fn();
        samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
      }
      return samples.sort((a, b) => a - b)[2]; // median
    };

    const unknown = await time(() => login('nobody@example.com', PASSWORD));
    const real = await time(() => login('exists@example.com', 'wrong password'));

    const ratio = Math.max(unknown, real) / Math.min(unknown, real);
    expect(ratio, `unknown ${unknown.toFixed(1)}ms vs real ${real.toFixed(1)}ms`).toBeLessThan(5);
  }, 30_000);

  /**
   * The ordering that would be an oracle is checking account status *before*
   * spending the hash: suspended accounts would then answer in microseconds
   * and be enumerable exactly as unknown addresses would.
   */
  it('spends the hash on a suspended account too, so status is not detectable', async () => {
    const suspended = await createUser('suspended@example.com', 'SUSPENDED');
    await setPassword(suspended, PASSWORD);
    await userWithPassword('active@example.com');

    await login('warmup@example.com', PASSWORD);

    // Asserted first, deliberately: the timing loop below spends exactly
    // `maxFailedAttempts` failures on this account, so any assertion after it
    // sees LOCKED_OUT — which is correct behaviour, and not what this test is
    // about.
    expect(await login('suspended@example.com', PASSWORD)).toEqual({
      ok: false,
      reason: 'INVALID_CREDENTIALS',
    });

    const time = async (fn: () => Promise<unknown>): Promise<number> => {
      const samples: number[] = [];
      for (let i = 0; i < 3; i += 1) {
        const t0 = process.hrtime.bigint();
        await fn();
        samples.push(Number(process.hrtime.bigint() - t0) / 1e6);
      }
      return samples.sort((a, b) => a - b)[1];
    };

    // Correct password, suspended account — the case that must not shortcut.
    const suspendedTime = await time(() => login('suspended@example.com', PASSWORD));
    const activeTime = await time(() => login('active@example.com', 'wrong password'));

    const ratio = Math.max(suspendedTime, activeTime) / Math.min(suspendedTime, activeTime);
    expect(
      ratio,
      `suspended ${suspendedTime.toFixed(1)}ms vs active ${activeTime.toFixed(1)}ms`,
    ).toBeLessThan(5);
  }, 60_000);

  it('records a failure for an unknown address without storing what was typed', async () => {
    await login('victim-typed-their-password-here@example.com', PASSWORD);

    const { rows } = await query<{ user_id: string | null; event_type: string }>(
      `select user_id, event_type from authentication_events`,
    );
    expect(rows).toEqual([{ user_id: null, event_type: 'LOGIN_FAILED' }]);

    // Nothing anywhere in the row carries the attempted address or password.
    const { rows: dump } = await query<Record<string, unknown>>(
      `select * from authentication_events`,
    );
    const serialised = JSON.stringify(dump);
    expect(serialised).not.toContain('victim-typed');
    expect(serialised).not.toContain(PASSWORD);
  });
});

describe('lockout', () => {
  it('blocks after the configured number of failures and stays quiet about it', async () => {
    await userWithPassword('bob@example.com');

    // PAS-0002 default: maxFailedAttempts = 5.
    for (let i = 0; i < 5; i += 1) {
      expect(await login('bob@example.com', 'wrong')).toEqual({
        ok: false,
        reason: 'INVALID_CREDENTIALS',
      });
    }

    // Now even the CORRECT password is refused.
    const blocked = await login('bob@example.com', PASSWORD);
    expect(blocked).toEqual({ ok: false, reason: 'LOCKED_OUT' });

    const { rows } = await query<{ event_type: string }>(
      `select event_type from authentication_events order by occurred_at`,
    );
    expect(rows.filter((r) => r.event_type === 'LOGIN_FAILED')).toHaveLength(5);
    expect(rows.filter((r) => r.event_type === 'LOGIN_BLOCKED')).toHaveLength(1);
  }, 30_000);

  it('counts only failures inside the window', async () => {
    const userId = await userWithPassword('bob@example.com');

    // Five failures, dated outside the 900s lockout window.
    const old = new Date(Date.now() - 3600_000).toISOString();
    for (let i = 0; i < 5; i += 1) {
      await query(
        `insert into authentication_events (id, user_id, event_type, occurred_at)
         values ($1, $2, 'LOGIN_FAILED', $3)`,
        [generateId(), userId, old],
      );
    }

    expect((await login('bob@example.com', PASSWORD)).ok).toBe(true);
  }, 30_000);

  it('does not lock an account that does not exist', async () => {
    for (let i = 0; i < 8; i += 1) await login('nobody@example.com', 'wrong');
    // Every outcome is the same one, so lockout is not an oracle either.
    expect(await login('nobody@example.com', 'wrong')).toEqual({
      ok: false,
      reason: 'INVALID_CREDENTIALS',
    });
  }, 30_000);
});

describe('what the database does not hold', () => {
  it('stores the digest of a session token, never the token', async () => {
    const userId = await userWithPassword('bob@example.com');
    const result = await login('bob@example.com', PASSWORD);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { token } = result.session;

    const { rows } = await query<{ token_hash: Buffer }>(`select token_hash from sessions`);
    expect(rows).toHaveLength(1);

    // A disclosed backup, replica or query log hands an attacker nothing they
    // can present as a session.
    expect(rows[0].token_hash.toString('base64url')).not.toBe(token);
    expect(rows[0].token_hash).toEqual(createHash('sha256').update(token, 'utf8').digest());
    expect(rows[0].token_hash).toEqual(hashSessionToken(token));

    const { rows: dump } = await query<Record<string, unknown>>(`select * from sessions`);
    expect(JSON.stringify(dump)).not.toContain(token);
    expect(userId).toBeTruthy();
  });

  it('stores no password material on the users table', async () => {
    await userWithPassword('bob@example.com');
    const { rows } = await query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'users'`,
    );
    const columns = rows.map((r) => r.column_name);
    // `select * from users` is written a hundred times over a codebase's life.
    // None of those can carry a hash if the hash is in another table.
    for (const forbidden of ['password', 'password_hash', 'secret', 'salt']) {
      expect(columns, forbidden).not.toContain(forbidden);
    }
  });

  it('refuses a plaintext password written into the credential column', async () => {
    const userId = await createUser('bob@example.com');
    await expect(
      query(
        `insert into user_credentials (id, user_id, password_hash, created_at, updated_at)
         values ($1, $2, $3, $4, $4)`,
        [generateId(), userId, PASSWORD, now()],
      ),
    ).rejects.toThrow();
  });
});

describe('sessions identify a user, never an Authority Entity', () => {
  it('gives sessions no column pointing at a subject of authority', async () => {
    const { rows } = await query<{ column_name: string }>(
      `select column_name from information_schema.columns
        where table_schema = 'public' and table_name = 'sessions' order by column_name`,
    );
    const columns = rows.map((r) => r.column_name);
    expect(columns).toContain('user_id');
    for (const forbidden of ['authority_entity_id', 'entity_id', 'account_id', 'pas_id']) {
      expect(columns, forbidden).not.toContain(forbidden);
    }
  });
});

describe('session lifecycle', () => {
  it('resolves a live session and refuses an unknown token', async () => {
    const userId = await createUser('bob@example.com');
    const { token } = await issueSession(userId);

    const resolved = await resolveSession(token);
    expect(resolved.ok).toBe(true);

    expect(await resolveSession(newSessionToken())).toEqual({ ok: false, reason: 'NOT_FOUND' });
  });

  it('refuses a session past its absolute expiry', async () => {
    const userId = await createUser('bob@example.com');
    const { token, session } = await issueSession(userId);

    // Created 13h ago, expired an hour ago. Absolute expiry is reported ahead
    // of idle expiry, so this stays a test of the absolute bound.
    await ageSession(session.id, { created: 13 * 60, expiresIn: -60, lastSeen: 13 * 60 });
    expect(await resolveSession(token)).toEqual({ ok: false, reason: 'EXPIRED' });
  });

  it('refuses a session that has been idle too long', async () => {
    const userId = await createUser('bob@example.com');
    const { token, session } = await issueSession(userId);

    // Created 4h ago, absolute expiry still 8h away, last seen 3h ago. The
    // default idle window is 2h, so only the idle bound is in play.
    await ageSession(session.id, { created: 4 * 60, expiresIn: 8 * 60, lastSeen: 3 * 60 });
    expect(await resolveSession(token)).toEqual({ ok: false, reason: 'IDLE_EXPIRED' });
  });

  it('refreshes the idle clock only on a request that succeeds', async () => {
    const userId = await createUser('bob@example.com');
    const { token, session } = await issueSession(userId);

    await ageSession(session.id, { created: 4 * 60, expiresIn: 8 * 60, lastSeen: 3 * 60 });
    const { rows: before } = await query<{ last_seen_at: Date }>(
      `select last_seen_at from sessions where id = $1`,
      [session.id],
    );

    // Idle-expired, and the failed resolution must not revive it — a stream of
    // requests bearing a dead token cannot keep it alive.
    expect(await resolveSession(token)).toEqual({ ok: false, reason: 'IDLE_EXPIRED' });
    const { rows: after } = await query<{ last_seen_at: Date }>(
      `select last_seen_at from sessions where id = $1`,
      [session.id],
    );
    expect(after[0].last_seen_at.toISOString()).toBe(before[0].last_seen_at.toISOString());
  });

  it('advances the idle clock on a successful resolution', async () => {
    const userId = await createUser('bob@example.com');
    const { token, session } = await issueSession(userId);

    await ageSession(session.id, { created: 60, expiresIn: 11 * 60, lastSeen: 1 });
    const resolved = await resolveSession(token);
    expect(resolved.ok).toBe(true);

    const { rows } = await query<{ last_seen_at: Date }>(
      `select last_seen_at from sessions where id = $1`,
      [session.id],
    );
    expect(Date.now() - rows[0].last_seen_at.getTime()).toBeLessThan(5_000);
  });

  it('refuses a revoked session and keeps it for the audit trail', async () => {
    const userId = await createUser('bob@example.com');
    const { token, session } = await issueSession(userId);

    await revokeSession(session.id, 'test');
    expect(await resolveSession(token)).toEqual({ ok: false, reason: 'REVOKED' });

    // Revoked, not deleted.
    const { rows } = await query<{ revoked_reason: string }>(
      `select revoked_reason from sessions where id = $1`,
      [session.id],
    );
    expect(rows[0].revoked_reason).toBe('test');
  });

  it('keeps the first reason when a revoked session is revoked again', async () => {
    const userId = await createUser('bob@example.com');
    const { session } = await issueSession(userId);

    await revokeSession(session.id, 'first');
    await revokeSession(session.id, 'second');

    const { rows } = await query<{ revoked_reason: string }>(
      `select revoked_reason from sessions where id = $1`,
      [session.id],
    );
    expect(rows[0].revoked_reason).toBe('first');
    // And only one revocation event, not two.
    const { rows: events } = await query<{ count: string }>(
      `select count(*) from authentication_events where event_type = 'SESSION_REVOKED'`,
    );
    expect(events[0].count).toBe('1');
  });

  it('revokes every live session for a user in one statement', async () => {
    const userId = await createUser('bob@example.com');
    const other = await createUser('carol@example.com');
    const tokens = [await issueSession(userId), await issueSession(userId), await issueSession(userId)];
    const untouched = await issueSession(other);

    expect(await revokeAllSessionsForUser(userId, 'password changed')).toBe(3);

    for (const { token } of tokens) {
      expect(await resolveSession(token)).toEqual({ ok: false, reason: 'REVOKED' });
    }
    expect((await resolveSession(untouched.token)).ok).toBe(true);

    // Revoking again revokes nothing; it is not double-counted.
    expect(await revokeAllSessionsForUser(userId, 'again')).toBe(0);
  });
});

describe('credential rotation', () => {
  it('replaces the credential rather than adding a second one', async () => {
    const userId = await userWithPassword('bob@example.com');
    await setPassword(userId, 'a completely different password');

    const { rows } = await query<{ count: string }>(
      `select count(*) from user_credentials where user_id = $1`,
      [userId],
    );
    expect(rows[0].count).toBe('1');

    expect((await login('bob@example.com', 'a completely different password')).ok).toBe(true);
    expect(await login('bob@example.com', PASSWORD)).toEqual({
      ok: false,
      reason: 'INVALID_CREDENTIALS',
    });
  }, 30_000);

  it('leaves existing sessions alone, because that is the caller\'s decision', async () => {
    const userId = await userWithPassword('bob@example.com');
    const { token } = await issueSession(userId);

    await setPassword(userId, 'a completely different password');

    // An administrative reset and a routine self-service change want opposite
    // behaviour, so the choice is explicit rather than implied.
    expect((await resolveSession(token)).ok).toBe(true);
    expect(await revokeAllSessionsForUser(userId, 'password changed')).toBe(1);
    expect(await resolveSession(token)).toEqual({ ok: false, reason: 'REVOKED' });
  }, 30_000);

  it('upgrades a weak hash on the next successful login', async () => {
    const userId = await userWithPassword('bob@example.com');

    // A credential stored under older, cheaper parameters.
    await query(`update user_credentials set password_hash = $2 where user_id = $1`, [
      userId,
      await hashPassword(PASSWORD, { ln: 12, r: 8, p: 1 }),
    ]);

    const before = await query<{ password_hash: string }>(
      `select password_hash from user_credentials where user_id = $1`,
      [userId],
    );
    expect(before.rows[0].password_hash).toContain('ln=12');

    expect((await login('bob@example.com', PASSWORD)).ok).toBe(true);

    const after = await query<{ password_hash: string }>(
      `select password_hash from user_credentials where user_id = $1`,
      [userId],
    );
    // Raised to current policy, with no migration and no forced reset.
    expect(after.rows[0].password_hash).toContain('ln=16');

    const { rows } = await query<{ count: string }>(
      `select count(*) from authentication_events where event_type = 'CREDENTIAL_REHASHED'`,
    );
    expect(rows[0].count).toBe('1');
  }, 30_000);
});
