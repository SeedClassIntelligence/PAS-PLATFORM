/**
 * PAS-0202 — the login flow.
 *
 * ── One failure, told one way ─────────────────────────────────────────────
 *
 * Every unsuccessful outcome returns the same `INVALID_CREDENTIALS` to the
 * caller. Whether the address exists, whether the user has a password set,
 * whether the password was close — none of it reaches the wire. A login form
 * that distinguishes "no such user" from "wrong password" is an account
 * enumeration oracle, and the addresses it confirms are the input to every
 * credential-stuffing run that follows.
 *
 * Saying it is not enough, because *timing* says it too. Rejecting an unknown
 * address early returns in microseconds while a real one spends ~200ms in
 * scrypt, and that gap is measurable over the internet. So an unknown address
 * is hashed anyway, against a fixed decoy, and the work is thrown away. The
 * cost is one wasted hash per invalid attempt; the alternative is publishing
 * the user list.
 *
 * ── Lockout ───────────────────────────────────────────────────────────────
 *
 * After `maxFailedAttempts` failures inside `lockoutSeconds`, further attempts
 * are refused — with the same message, so lockout is not an oracle either.
 * It applies only to users that exist: an account that does not exist cannot
 * be locked, and pretending otherwise would require exactly the record of
 * attempted addresses that `authentication_events` refuses to keep.
 */

import { query, withTransaction, type PoolClient } from '@pas/database';
import { generateId, parseId } from '@pas/domain';
import { now, toDate, fromDate, type Instant } from '@pas/contracts';
import { getConfig } from '@pas/config';
import { hashPassword, verifyPassword, needsRehash } from './password/hash.js';
import { issueSession, type IssuedSession } from './session/sessions.js';
import { recordAuthenticationEvent, countRecentFailures, type RequestContext } from './events.js';

/**
 * A hash of a value nobody knows, used to spend the same time on an unknown
 * address as on a real one.
 *
 * Computed once at module load with the configured parameters. It is not a
 * secret and does not need to be: its only job is to be a well-formed input to
 * `verifyPassword` so the work is real rather than skipped.
 */
let decoyHash: Promise<string> | undefined;
function decoy(): Promise<string> {
  decoyHash ??= hashPassword(`decoy-${generateId()}-${generateId()}`);
  return decoyHash;
}

export type LoginFailure =
  /** Wrong address, wrong password, no credential set, suspended user — all of them. */
  | 'INVALID_CREDENTIALS'
  /** Too many recent failures. Deliberately indistinguishable to the caller. */
  | 'LOCKED_OUT';

export type LoginResult =
  | { ok: true; userId: string; session: IssuedSession }
  | { ok: false; reason: LoginFailure };

interface CredentialRow {
  user_id: string;
  status: string;
  password_hash: string | null;
  credential_id: string | null;
}

/**
 * Authenticates an address and password.
 *
 * `LOCKED_OUT` is returned separately from `INVALID_CREDENTIALS` so that a
 * *caller* can log and rate-limit accurately. Callers must render both as one
 * message; the distinction is for the audit trail, not the response body.
 */
export async function login(
  email: string,
  password: string,
  context: RequestContext = {},
): Promise<LoginResult> {
  const { authentication } = getConfig();

  // Case folding matches `users.email_normalized` (PAS-0201), which is what
  // the unique index is on. Comparing raw input would let 'Bob@…' miss a row
  // stored as 'bob@…' and report invalid credentials for a correct password.
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';

  const { rows } = await query<CredentialRow>(
    `select u.id as user_id, u.status, c.password_hash, c.id as credential_id
       from users u
       left join user_credentials c on c.user_id = u.id
      where u.email_normalized = $1`,
    [normalized],
    { operation: 'auth.login.lookup' },
  );

  const found = rows[0];

  // Unknown address, or a user with no credential set: spend the same time
  // and take the same path, then fail identically.
  if (!found || found.password_hash === null) {
    await verifyPassword(password, await decoy());
    await recordAuthenticationEvent({ type: 'LOGIN_FAILED', userId: null, ...context });
    return { ok: false, reason: 'INVALID_CREDENTIALS' };
  }

  const lockoutSince = fromDate(
    new Date(toDate(now()).getTime() - authentication.lockoutSeconds * 1000),
  );
  const failures = await countRecentFailures(found.user_id, lockoutSince);
  if (failures >= authentication.maxFailedAttempts) {
    // Still hashed, so a locked account does not answer faster than an
    // unlocked one and become detectable that way.
    await verifyPassword(password, found.password_hash);
    await recordAuthenticationEvent({
      type: 'LOGIN_BLOCKED',
      userId: found.user_id,
      ...context,
    });
    return { ok: false, reason: 'LOCKED_OUT' };
  }

  // Unconditional, and that is what makes account status safe to check —
  // not the order of the test below. A suspended user must not answer faster
  // than a live one, so the hash is spent before status is consulted; whether
  // `!correct` or the status test short-circuits first is then immaterial,
  // because the expensive work has already happened either way.
  //
  // Moving the status check *above* this line is the oracle. A test asserts
  // a suspended account with a correct password takes comparable time to a
  // live account with a wrong one.
  const correct = await verifyPassword(password, found.password_hash);

  if (!correct || found.status !== 'ACTIVE') {
    await recordAuthenticationEvent({
      type: 'LOGIN_FAILED',
      userId: found.user_id,
      ...context,
    });
    return { ok: false, reason: 'INVALID_CREDENTIALS' };
  }

  return withTransaction(
    async (tx) => {
      const session = await issueSession(found.user_id, tx);

      // The one moment the plaintext is available to re-hash with. This is
      // what lets the cost be raised without a migration or a forced reset.
      if (needsRehash(found.password_hash as string)) {
        await setPasswordHash(found.user_id, await hashPassword(password), tx);
        await recordAuthenticationEvent(
          { type: 'CREDENTIAL_REHASHED', userId: found.user_id, ...context },
          tx,
        );
      }

      await recordAuthenticationEvent(
        {
          type: 'LOGIN_SUCCEEDED',
          userId: found.user_id,
          sessionId: session.session.id,
          ...context,
        },
        tx,
      );
      return { ok: true as const, userId: found.user_id, session };
    },
    { operation: 'auth.login' },
  );
}

/** Writes a credential row, replacing any existing one for the user. */
async function setPasswordHash(
  userId: string,
  encoded: string,
  client?: PoolClient,
): Promise<void> {
  const at: Instant = now();
  await query(
    `insert into user_credentials (id, user_id, password_hash, created_at, updated_at)
     values ($1, $2, $3, $4, $4)
     on conflict (user_id) do update
        set password_hash = excluded.password_hash, updated_at = excluded.updated_at`,
    [generateId(), userId, encoded, at],
    { client, operation: 'auth.credential.set' },
  );
}

/**
 * Sets or replaces a user's password.
 *
 * Does **not** revoke existing sessions. That is the caller's decision and a
 * deliberate omission: an administrative reset and a routine self-service
 * change want opposite behaviour, and silently ending every session of a user
 * who simply rotated a password is the kind of surprise that gets worked
 * around by not rotating. `revokeAllSessionsForUser` is one call.
 */
export async function setPassword(
  userId: string,
  password: string,
  context: RequestContext = {},
): Promise<void> {
  const id = parseId(userId, 'userId');
  const encoded = await hashPassword(password);

  await withTransaction(
    async (tx) => {
      await setPasswordHash(id, encoded, tx);
      await recordAuthenticationEvent({ type: 'CREDENTIAL_SET', userId: id, ...context }, tx);
    },
    { operation: 'auth.credential.set' },
  );
}
