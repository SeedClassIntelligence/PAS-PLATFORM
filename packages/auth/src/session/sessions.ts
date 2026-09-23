/**
 * PAS-0202 — session lifecycle.
 *
 * A session identifies a **user**. It does not identify an Authority Entity,
 * and there is deliberately no column that could: what a user may do about a
 * subject of authority is reached through `account_memberships` and decided by
 * PAS-0204. "Authentication and Authority Entity identity remain separate" is
 * a statement about shape, and this is the shape.
 *
 * ── Two expiries, defending different things ──────────────────────────────
 *
 *   absolute (`expires_at`)   bounds how long a stolen token is ever useful,
 *                             however active the session looks
 *   idle (`last_seen_at`)     closes an abandoned session on a shared machine
 *                             long before the absolute one would
 *
 * Only one of them is not enough. Absolute-only leaves a session live on a
 * library computer for twelve hours; idle-only lets an attacker who keeps a
 * stolen token warm hold it forever.
 */

import { query, withTransaction, type PoolClient } from '@pas/database';
import { generateId } from '@pas/domain';
import { now, toDate, fromDate, type Instant } from '@pas/contracts';
import { getConfig } from '@pas/config';
import { newSessionToken, hashSessionToken } from './tokens.js';
import { recordAuthenticationEvent, type RequestContext } from '../events.js';

export interface Session {
  id: string;
  userId: string;
  createdAt: Instant;
  expiresAt: Instant;
  lastSeenAt: Instant;
  revokedAt: Instant | null;
}

export interface IssuedSession {
  session: Session;
  /**
   * The only time this value exists. It is not stored and cannot be recovered
   * — the database holds its SHA-256 — so a caller that loses it must issue a
   * new session.
   */
  token: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  created_at: Date;
  expires_at: Date;
  last_seen_at: Date;
  revoked_at: Date | null;
}

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    createdAt: fromDate(row.created_at),
    expiresAt: fromDate(row.expires_at),
    lastSeenAt: fromDate(row.last_seen_at),
    revokedAt: row.revoked_at === null ? null : fromDate(row.revoked_at),
  };
}

function plus(instant: Instant, seconds: number): Instant {
  return fromDate(new Date(toDate(instant).getTime() + seconds * 1000));
}

/**
 * Issues a session and returns the token once.
 *
 * Records no event, deliberately. The caller knows *why* a session was issued
 * — a login, and later an impersonation or an SSO assertion — and records that
 * with its own context. An event emitted here would either duplicate the
 * caller's or describe the act in terms too generic to audit.
 */
export async function issueSession(
  userId: string,
  client?: PoolClient,
): Promise<IssuedSession> {
  const { session: config } = getConfig();
  const issuedAt = now();
  const token = newSessionToken();

  const { rows } = await query<SessionRow>(
    `insert into sessions
       (id, user_id, token_hash, created_at, updated_at, expires_at, last_seen_at)
     values ($1, $2, $3, $4, $4, $5, $4)
     returning id, user_id, created_at, expires_at, last_seen_at, revoked_at`,
    [generateId(), userId, hashSessionToken(token), issuedAt, plus(issuedAt, config.ttlSeconds)],
    { client, operation: 'auth.session.issue' },
  );

  return { session: toSession(rows[0]), token };
}

export type SessionRejection =
  | 'NOT_FOUND'
  | 'EXPIRED'
  | 'IDLE_EXPIRED'
  | 'REVOKED';

export type SessionResolution =
  | { ok: true; session: Session }
  | { ok: false; reason: SessionRejection };

/**
 * Resolves a token to a live session, refreshing its idle clock.
 *
 * A rejected session is distinguished by *reason* for the audit trail, and
 * callers must not pass that reason to an unauthenticated client: "expired"
 * and "revoked" both confirm the token was real, which "not found" does not.
 * One indistinguishable failure goes on the wire.
 */
export async function resolveSession(
  token: string,
  client?: PoolClient,
): Promise<SessionResolution> {
  const { session: config } = getConfig();

  const { rows } = await query<SessionRow>(
    `select id, user_id, created_at, expires_at, last_seen_at, revoked_at
       from sessions where token_hash = $1`,
    [hashSessionToken(token)],
    { client, operation: 'auth.session.resolve' },
  );

  if (rows.length === 0) return { ok: false, reason: 'NOT_FOUND' };

  const session = toSession(rows[0]);
  const at = now();

  if (session.revokedAt !== null) return { ok: false, reason: 'REVOKED' };
  if (at >= session.expiresAt) return { ok: false, reason: 'EXPIRED' };
  if (at >= plus(session.lastSeenAt, config.idleTimeoutSeconds)) {
    return { ok: false, reason: 'IDLE_EXPIRED' };
  }

  // The idle clock only moves forward on a request that was going to succeed,
  // so a stream of requests bearing an expired token cannot keep it alive.
  await query(
    `update sessions set last_seen_at = $2, updated_at = $2 where id = $1`,
    [session.id, at],
    { client, operation: 'auth.session.touch' },
  );

  return { ok: true, session: { ...session, lastSeenAt: at } };
}

/** Revokes one session. Idempotent: revoking a revoked session keeps the first reason. */
export async function revokeSession(
  sessionId: string,
  reason: string,
  context: RequestContext = {},
): Promise<void> {
  await withTransaction(
    async (tx) => {
      const { rows } = await query<{ user_id: string }>(
        `update sessions set revoked_at = $2, revoked_reason = $3, updated_at = $2
          where id = $1 and revoked_at is null
        returning user_id`,
        [sessionId, now(), reason],
        { client: tx, operation: 'auth.session.revoke' },
      );
      if (rows.length === 0) return;
      await recordAuthenticationEvent(
        { type: 'SESSION_REVOKED', userId: rows[0].user_id, sessionId, ...context },
        tx,
      );
    },
    { operation: 'auth.session.revoke' },
  );
}

/**
 * Revokes every live session for a user, and says how many.
 *
 * The path for a password change, a compromise report and a support request.
 * One statement rather than a read-then-write loop, so a session issued while
 * this runs is either revoked or issued after the revocation — never skipped
 * because it appeared between the read and the write.
 */
export async function revokeAllSessionsForUser(
  userId: string,
  reason: string,
  context: RequestContext = {},
): Promise<number> {
  return withTransaction(
    async (tx) => {
      const { rows } = await query<{ id: string }>(
        `update sessions set revoked_at = $2, revoked_reason = $3, updated_at = $2
          where user_id = $1 and revoked_at is null
        returning id`,
        [userId, now(), reason],
        { client: tx, operation: 'auth.session.revoke_all' },
      );
      for (const row of rows) {
        await recordAuthenticationEvent(
          { type: 'SESSION_REVOKED', userId, sessionId: row.id, ...context },
          tx,
        );
      }
      return rows.length;
    },
    { operation: 'auth.session.revoke_all' },
  );
}
