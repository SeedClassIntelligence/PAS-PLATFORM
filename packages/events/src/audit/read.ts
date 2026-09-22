/**
 * PAS-0301 — reading the audit ledger.
 *
 * Reading is a capability (`audit.read`, PAS-0203) and this module does not
 * check it: authorization is the caller's, decided by PAS-0204 against the
 * account whose record is being read. A reader that authorized itself would be
 * the bypass PAS-0204's guard exists to prevent.
 */

import { query, type PoolClient } from '@pas/database';
import { fromDate, type Instant } from '@pas/contracts';
import { type AuditEntry } from './types.js';

export interface AuditQuery {
  actorId?: string;
  targetType?: string;
  targetId?: string;
  correlationId?: string;
  /** Inclusive lower bound. */
  since?: Instant;
  /** Bounded by default: an unbounded audit read is a memory incident. */
  limit?: number;
}

interface Row {
  id: string;
  sequence: string;
  occurred_at: Date;
  actor_type: 'USER' | 'SYSTEM' | 'ANONYMOUS';
  actor_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  authority_entity_id: string | null;
  before_ref: string | null;
  after_ref: string | null;
  authorization_result: 'ALLOW' | 'DENY' | null;
  authorization_reason: string | null;
  governance_decision: string | null;
  origin: AuditEntry['origin'];
  correlation_id: string | null;
  metadata: Record<string, unknown>;
}

const MAX_LIMIT = 500;

function toEntry(row: Row): AuditEntry {
  return {
    id: row.id,
    occurredAt: fromDate(row.occurred_at),
    actor: {
      type: row.actor_type,
      ...(row.actor_id === null ? {} : { id: row.actor_id }),
    },
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    origin: row.origin,
    ...(row.authority_entity_id === null ? {} : { authorityEntityId: row.authority_entity_id }),
    ...(row.before_ref === null ? {} : { beforeRef: row.before_ref }),
    ...(row.after_ref === null ? {} : { afterRef: row.after_ref }),
    ...(row.authorization_result === null
      ? {}
      : { authorizationResult: row.authorization_result }),
    ...(row.authorization_reason === null
      ? {}
      : { authorizationReason: row.authorization_reason }),
    ...(row.governance_decision === null
      ? {}
      : { governanceDecision: row.governance_decision }),
    ...(row.correlation_id === null ? {} : { correlationId: row.correlation_id }),
    metadata: row.metadata,
  };
}

/**
 * Most recent first, by insertion order.
 *
 * Ordered by `sequence`, not by `occurred_at`: canonical timestamps are
 * millisecond-precision (PAS-0104) and identifiers are random (PAS-0103), so
 * entries written inside one millisecond would otherwise come back in an
 * arbitrary order. See the migration.
 */
export async function readAuditEntries(
  filter: AuditQuery = {},
  client?: PoolClient,
): Promise<AuditEntry[]> {
  const conditions: string[] = [];
  const values: unknown[] = [];

  const add = (sql: string, value: unknown): void => {
    values.push(value);
    conditions.push(sql.replace('$?', `$${values.length}`));
  };

  if (filter.actorId) add('actor_id = $?', filter.actorId);
  if (filter.targetType) add('target_type = $?', filter.targetType);
  if (filter.targetId) add('target_id = $?', filter.targetId);
  if (filter.correlationId) add('correlation_id = $?', filter.correlationId);
  if (filter.since) add('occurred_at >= $?', filter.since);

  values.push(Math.min(filter.limit ?? 100, MAX_LIMIT));

  const { rows } = await query<Row>(
    `select * from audit_entries
      ${conditions.length > 0 ? `where ${conditions.join(' and ')}` : ''}
      order by sequence desc
      limit $${values.length}`,
    values,
    { client, operation: 'audit.read' },
  );

  return rows.map(toEntry);
}
