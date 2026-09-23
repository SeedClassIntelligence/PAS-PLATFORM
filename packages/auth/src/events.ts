/**
 * PAS-0202 — authentication events.
 *
 * Append-only. There is no update and no delete, and none is provided: an
 * audit record a caller can revise is not an audit record. PAS-0301's ledger
 * will subsume the general case; this exists now because a failed login that
 * leaves no trace is indistinguishable from no attempt, and lockout has to
 * count something.
 */

import { query, type PoolClient } from '@pas/database';
import { generateId } from '@pas/domain';
import { now } from '@pas/contracts';

export type AuthenticationEventType =
  | 'LOGIN_SUCCEEDED'
  | 'LOGIN_FAILED'
  | 'LOGIN_BLOCKED'
  | 'LOGOUT'
  | 'SESSION_REVOKED'
  | 'CREDENTIAL_SET'
  | 'CREDENTIAL_REHASHED';

export interface RequestContext {
  /** Null when the request arrived without one. */
  sourceIp?: string | null;
  userAgent?: string | null;
}

export interface AuthenticationEvent extends RequestContext {
  type: AuthenticationEventType;
  /** Null when the attempt named a user that does not exist — see below. */
  userId?: string | null;
  sessionId?: string | null;
}

/** Long enough to identify a client, short enough not to be a text sink. */
const MAX_USER_AGENT = 512;

function trim(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed.slice(0, MAX_USER_AGENT);
}

/**
 * Records an authentication event.
 *
 * **Never records the attempted email address for an unknown user.** The
 * operational need — spotting credential stuffing — is served by counting
 * attempts per source address. Recording whatever was typed produces a
 * permanent log of other people's addresses and, every time someone types
 * their password into the email field, of their password.
 */
export async function recordAuthenticationEvent(
  event: AuthenticationEvent,
  client?: PoolClient,
): Promise<void> {
  // Always through `query`, never `client.query` directly, even when a client
  // is supplied: `query` is what prepends the correlation comment and what
  // maps driver errors, whose messages carry the connection string. Branching
  // to the raw client would silently lose both on the transaction path.
  await query(
    `insert into authentication_events
       (id, user_id, event_type, occurred_at, source_ip, user_agent, session_id)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      generateId(),
      event.userId ?? null,
      event.type,
      now(),
      trim(event.sourceIp),
      trim(event.userAgent),
      event.sessionId ?? null,
    ],
    { client, operation: `auth.event.${event.type}` },
  );
}

/** Failed attempts for a user since an instant. The input to lockout. */
export async function countRecentFailures(
  userId: string,
  since: string,
  client?: PoolClient,
): Promise<number> {
  const { rows } = await query<{ failures: number }>(
    `select count(*)::int as failures
       from authentication_events
      where user_id = $1 and occurred_at >= $2
        and event_type = 'LOGIN_FAILED'`,
    [userId, since],
    { client, operation: 'auth.count_failures' },
  );
  return rows[0]?.failures ?? 0;
}
