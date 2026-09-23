/**
 * PAS-0101 — mapping driver failures onto the shared error contract.
 *
 * A raw `pg` error must never escape this package. Its `message` routinely
 * carries the connection string, and PAS-0003's serialiser would classify it as
 * an opaque `InternalError` — correct, but it throws away information the
 * caller legitimately needs. A unique-violation is a `ConflictError` the caller
 * can act on; a connection refusal is a retryable `ExternalServiceError` a
 * workflow can back off from (PAS-0304).
 *
 * Mapping here is what lets the rest of PAS catch typed errors instead of
 * matching on driver strings.
 */

import {
  isPasError,
  ConflictError,
  ExternalServiceError,
  ValidationError,
  InternalError,
  type PasError,
} from '@pas/contracts';

/**
 * PostgreSQL error classes and codes.
 * @see https://www.postgresql.org/docs/16/errcodes-appendix.html
 */
const PG = {
  UNIQUE_VIOLATION: '23505',
  DUPLICATE_TABLE: '42P07',
  DUPLICATE_COLUMN: '42701',
  DUPLICATE_OBJECT: '42710',
  DUPLICATE_SCHEMA: '42P06',
  UNDEFINED_TABLE: '42P01',
  UNDEFINED_COLUMN: '42703',
  FOREIGN_KEY_VIOLATION: '23503',
  NOT_NULL_VIOLATION: '23502',
  CHECK_VIOLATION: '23514',
  EXCLUSION_VIOLATION: '23P01',
  SERIALIZATION_FAILURE: '40001',
  DEADLOCK_DETECTED: '40P01',
  QUERY_CANCELED: '57014',
  ADMIN_SHUTDOWN: '57P01',
  CRASH_SHUTDOWN: '57P02',
  CANNOT_CONNECT_NOW: '57P03',
  TOO_MANY_CONNECTIONS: '53300',
  OUT_OF_MEMORY: '53200',
  DISK_FULL: '53100',
  READ_ONLY_TRANSACTION: '25006',
} as const;

/** Connection-level failures surface as libuv/OS codes, not SQLSTATE. */
const RETRYABLE_SYSTEM_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
  'ENOTFOUND',
  'EHOSTUNREACH',
  'ENETUNREACH',
]);

interface DriverError {
  code?: string;
  constraint?: string;
  table?: string;
  detail?: string;
  message?: string;
}

function asDriverError(value: unknown): DriverError | undefined {
  return value !== null && typeof value === 'object' ? (value as DriverError) : undefined;
}

/**
 * Whether a failure is worth retrying.
 *
 * Serialization failures and deadlocks are the interesting cases: both mean
 * "your transaction was correct but lost a race", and both succeed on retry.
 * Treating them as permanent turns ordinary contention into user-visible errors.
 */
export function isRetryable(value: unknown): boolean {
  const error = asDriverError(value);
  if (!error?.code) return false;
  return (
    RETRYABLE_SYSTEM_CODES.has(error.code) ||
    error.code === PG.SERIALIZATION_FAILURE ||
    error.code === PG.DEADLOCK_DETECTED ||
    error.code === PG.CANNOT_CONNECT_NOW ||
    error.code === PG.TOO_MANY_CONNECTIONS ||
    error.code === PG.ADMIN_SHUTDOWN ||
    error.code === PG.CRASH_SHUTDOWN
  );
}

/**
 * Converts a driver failure into a `PasError`.
 *
 * `cause` retains the original for logging. PAS-0003 never serialises a cause
 * to a client, so the connection string inside it cannot escape.
 *
 * Details carry the constraint and table but **never** `error.detail`: Postgres
 * puts the offending row's values in that field — `Key (email)=(a@b.com)
 * already exists` — which would echo user data straight back onto the wire.
 */
export function toDatabaseError(value: unknown, context: { operation?: string } = {}): PasError {
  // Already typed — a ConflictError from a nested query, or a domain error
  // raised by the caller. Re-wrapping it would destroy the family and message
  // the caller depends on.
  if (isPasError(value)) return value;

  const error = asDriverError(value);
  const code = error?.code;
  const operation = context.operation;

  if (!code) {
    return new InternalError('Database operation failed.', { cause: value });
  }

  switch (code) {
    case PG.UNIQUE_VIOLATION:
      return new ConflictError('The value already exists.', {
        code: 'database.unique_violation',
        details: { constraint: error?.constraint, table: error?.table },
        cause: value,
      });

    case PG.DUPLICATE_TABLE:
    case PG.DUPLICATE_COLUMN:
    case PG.DUPLICATE_OBJECT:
    case PG.DUPLICATE_SCHEMA:
      // A migration creating an object that already exists is a conflict, not
      // an opaque service failure — PAS-0102 needs to distinguish the two.
      return new ConflictError('The database object already exists.', {
        code: 'database.duplicate_object',
        details: { table: error?.table },
        cause: value,
      });

    case PG.FOREIGN_KEY_VIOLATION:
      return new ConflictError('A referenced record does not exist, or is still referenced.', {
        code: 'database.foreign_key_violation',
        details: { constraint: error?.constraint, table: error?.table },
        cause: value,
      });

    case PG.NOT_NULL_VIOLATION:
    case PG.CHECK_VIOLATION:
    case PG.EXCLUSION_VIOLATION:
      return new ValidationError('The record violates a database constraint.', [], {
        code: 'database.constraint_violation',
        details: { constraint: error?.constraint, table: error?.table },
        cause: value,
      });

    case PG.SERIALIZATION_FAILURE:
    case PG.DEADLOCK_DETECTED:
      return new ExternalServiceError('postgres', 'The transaction lost a concurrency race.', {
        code: 'database.serialization_failure',
        retryable: true,
        cause: value,
      });

    case PG.QUERY_CANCELED:
      // Almost always statement_timeout. The query is not coming back faster
      // on retry, so this is deliberately NOT retryable.
      return new ExternalServiceError('postgres', 'The query exceeded its time limit.', {
        code: 'database.statement_timeout',
        retryable: false,
        details: { operation },
        cause: value,
      });

    case PG.READ_ONLY_TRANSACTION:
      return new ExternalServiceError('postgres', 'The database is read-only.', {
        code: 'database.read_only',
        retryable: false,
        cause: value,
      });

    default:
      return new ExternalServiceError('postgres', 'The database operation failed.', {
        code: `database.${code.toLowerCase()}`,
        retryable: isRetryable(value),
        cause: value,
      });
  }
}

export const PG_ERROR_CODES = PG;
