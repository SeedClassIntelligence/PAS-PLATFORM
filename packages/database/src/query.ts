/**
 * PAS-0101 — query execution and instrumentation.
 *
 * ── Instrumentation ───────────────────────────────────────────────────────
 *
 * Every statement is prefixed with a SQL comment carrying the PAS-0004
 * correlation id and the operation label:
 *
 *     -- pas:corr=01J8XYZ op=claim.approve
 *     update claims set ...
 *
 * A log line would be cheaper, but the comment travels *into Postgres*. It
 * appears in `pg_stat_activity`, in `log_min_duration_statement` output and in
 * `pg_stat_statements`, which means a slow query found by a DBA can be traced
 * back to the request that caused it without correlating timestamps across two
 * systems. That is the difference between instrumentation and logging.
 *
 * ── Why embedding the id is not an injection vector ───────────────────────
 *
 * The id is interpolated into SQL text, so it must not be able to terminate
 * the comment or introduce a newline. PAS-0004's `isValidId` restricts ids to
 * `[A-Za-z0-9._-]` — no quotes, no newline, no `*`, no `/`. The safety comes
 * from that validation, so this module re-checks rather than assuming: a
 * correlation id that fails the check is dropped, not escaped.
 */

import { currentContext, isValidId } from '@pas/observability';
import { withConnection, type PoolClient } from './pool.js';
import { toDatabaseError } from './errors.js';

export interface QueryResult<Row> {
  rows: Row[];
  rowCount: number;
}

export interface QueryOptions {
  /** Short label for the operation, e.g. `claim.approve`. Appears in Postgres. */
  operation?: string;
  /** Run on an existing connection — inside a transaction, for instance. */
  client?: PoolClient;
}

/** Label charset, applied for the same reason as the id charset. */
const SAFE_OPERATION = /^[A-Za-z0-9._:-]{1,64}$/;

/**
 * Builds the instrumentation comment.
 *
 * Returns an empty string when nothing is safely available, rather than
 * emitting a partial or escaped value.
 */
export function instrumentationComment(operation?: string): string {
  const parts: string[] = [];

  const correlationId = currentContext()?.correlationId;
  if (isValidId(correlationId)) parts.push(`corr=${correlationId}`);

  if (operation && SAFE_OPERATION.test(operation)) parts.push(`op=${operation}`);

  return parts.length > 0 ? `-- pas:${parts.join(' ')}\n` : '';
}

/**
 * Executes a parameterised statement.
 *
 * `params` is always passed to the driver separately — values are never
 * interpolated into SQL text. The only thing this module adds to the text is
 * the comment above, from a validated charset.
 */
export async function query<Row extends object = Record<string, unknown>>(
  text: string,
  params: readonly unknown[] = [],
  options: QueryOptions = {},
): Promise<QueryResult<Row>> {
  const sql = instrumentationComment(options.operation) + text;

  const run = async (client: PoolClient): Promise<QueryResult<Row>> => {
    const result = await client.query<Row>(sql, params as unknown[]);
    return { rows: result.rows, rowCount: result.rowCount ?? 0 };
  };

  try {
    return options.client ? await run(options.client) : await withConnection(run);
  } catch (error) {
    // A raw driver error never escapes this package: its message carries the
    // connection string.
    throw toDatabaseError(error, { operation: options.operation });
  }
}

/**
 * Executes a statement expected to return exactly one row.
 *
 * Returns `undefined` for no rows. Throws when more than one comes back —
 * a query that was meant to be unique and is not indicates a missing
 * constraint, and silently taking `rows[0]` hides that until the wrong record
 * has been served to somebody.
 */
export async function queryOne<Row extends object = Record<string, unknown>>(
  text: string,
  params: readonly unknown[] = [],
  options: QueryOptions = {},
): Promise<Row | undefined> {
  const { rows } = await query<Row>(text, params, options);
  if (rows.length > 1) {
    throw toDatabaseError(
      Object.assign(new Error(`expected at most 1 row, received ${rows.length}`), {
        code: 'PAS_MULTIPLE_ROWS',
      }),
      { operation: options.operation },
    );
  }
  return rows[0];
}
