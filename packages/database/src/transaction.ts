/**
 * PAS-0101 — transactions.
 *
 * Part I §5 is the binding requirement:
 *
 *   "A canonical mutation and its required outbox event SHALL occur within the
 *    same transaction. … Never: update claim / commit / attempt event
 *    publication later. That creates state/event divergence."
 *
 * ── Why nesting uses savepoints, not a second BEGIN ───────────────────────
 *
 * The failure this prevents is subtle and severe. A claim service opens a
 * transaction, mutates the claim, then calls an audit service that also wraps
 * its work in `withTransaction`. If the inner call issued its own COMMIT, it
 * would commit the *outer* transaction too — Postgres has one transaction per
 * connection. The claim is now durable, the outbox event has not been written,
 * and the two diverge exactly as §5 forbids. Worse, the outer caller then
 * throws, "rolls back", and nothing happens.
 *
 * So: the first `withTransaction` on a connection owns BEGIN/COMMIT. Every
 * nested call becomes a SAVEPOINT, which can roll back its own work without
 * touching the enclosing transaction. Only the outermost frame commits.
 *
 * The current transaction travels through `AsyncLocalStorage` rather than a
 * threaded parameter, for the same reason PAS-0004 propagates correlation that
 * way: a contract expensive enough to thread gets routed around, and here
 * routing around it means silently losing atomicity.
 */

import { AsyncLocalStorage } from 'node:async_hooks';
import { withConnection, type PoolClient } from './pool.js';
import { toDatabaseError, isRetryable } from './errors.js';
import { instrumentationComment } from './query.js';

export type IsolationLevel =
  | 'READ COMMITTED'
  | 'REPEATABLE READ'
  | 'SERIALIZABLE';

interface TransactionFrame {
  client: PoolClient;
  depth: number;
  /** Set when a nested frame fails, so the outer frame cannot commit. */
  poisoned: boolean;
}

const storage = new AsyncLocalStorage<TransactionFrame>();

export interface TransactionOptions {
  isolation?: IsolationLevel;
  readOnly?: boolean;
  operation?: string;
  /**
   * Retry the whole callback when Postgres reports a serialization failure or
   * deadlock.
   *
   * **Off by default, deliberately.** A retry re-runs the callback, and a
   * callback that sent an email, called an external API or enqueued work
   * outside the transaction will do it twice. Only opt in where the callback
   * is genuinely idempotent — which, under §5, means everything it does is
   * inside this transaction.
   */
  retries?: number;
}

/** The client of the transaction in progress, if any. */
export function currentTransactionClient(): PoolClient | undefined {
  return storage.getStore()?.client;
}

export function inTransaction(): boolean {
  return storage.getStore() !== undefined;
}

/** Nesting depth. 0 outside a transaction, 1 for the outermost frame. */
export function transactionDepth(): number {
  return storage.getStore()?.depth ?? 0;
}

let savepointCounter = 0;

async function runNested<T>(
  frame: TransactionFrame,
  fn: (client: PoolClient) => Promise<T>,
  operation?: string,
): Promise<T> {
  const name = `pas_sp_${(savepointCounter += 1)}`;
  const comment = instrumentationComment(operation);

  try {
    await frame.client.query(`${comment}savepoint ${name}`);
  } catch (error) {
    throw toDatabaseError(error, { operation });
  }

  const nested: TransactionFrame = { ...frame, depth: frame.depth + 1 };

  let result: T;
  try {
    result = await storage.run(nested, () => fn(frame.client));
  } catch (error) {
    try {
      await frame.client.query(`rollback to savepoint ${name}`);
    } catch {
      // The connection is unusable. Poison the frame so the outer COMMIT
      // cannot run and claim success over a transaction that is already lost.
      frame.poisoned = true;
    }
    // The callback's error is the caller's — a domain error, or one already
    // mapped by `query`. Wrapping it here would flatten every failure inside a
    // transaction into an opaque InternalError.
    throw error;
  }

  try {
    await frame.client.query(`${comment}release savepoint ${name}`);
  } catch (error) {
    throw toDatabaseError(error, { operation });
  }
  return result;
}

async function runOutermost<T>(
  fn: (client: PoolClient) => Promise<T>,
  options: TransactionOptions,
): Promise<T> {
  return withConnection(async (client) => {
    const comment = instrumentationComment(options.operation);
    const modes = [
      options.isolation ? `isolation level ${options.isolation}` : undefined,
      options.readOnly ? 'read only' : undefined,
    ].filter(Boolean);

    try {
      await client.query(`${comment}begin${modes.length ? ` ${modes.join(' ')}` : ''}`);
    } catch (error) {
      throw toDatabaseError(error, { operation: options.operation });
    }

    const frame: TransactionFrame = { client, depth: 1, poisoned: false };
    let result: T;

    try {
      result = await storage.run(frame, () => fn(client));
      if (frame.poisoned) {
        throw new Error('a nested transaction frame failed unrecoverably');
      }
    } catch (error) {
      try {
        await client.query('rollback');
      } catch {
        // Rolling back a connection the server already closed is expected;
        // the transaction is aborted either way. Swallowing this preserves
        // the original error, which is the one that explains the failure.
      }
      // Propagate the caller's error unchanged. `query` has already mapped
      // anything that came from the driver.
      throw error;
    }

    try {
      await client.query(`${comment}commit`);
    } catch (error) {
      throw toDatabaseError(error, { operation: options.operation });
    }
    return result;
  });
}

/**
 * Runs `fn` inside a transaction. Commits when it resolves, rolls back when it
 * throws.
 *
 * Nested calls join the enclosing transaction via a savepoint — only the
 * outermost frame commits.
 *
 * ```ts
 * await withTransaction(async (tx) => {
 *   await query('update claims set ...', [id], { client: tx });
 *   await query('insert into claim_versions ...', [id], { client: tx });
 *   await query('insert into audit_entries ...', [id], { client: tx });
 *   await query('insert into outbox_events ...', [id], { client: tx });
 * });                                          // one COMMIT, per Part I §5
 * ```
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
  options: TransactionOptions = {},
): Promise<T> {
  const existing = storage.getStore();

  if (existing) {
    if (options.isolation || options.readOnly !== undefined) {
      // Silently ignoring these would let a caller believe it had SERIALIZABLE
      // when it had inherited READ COMMITTED — a correctness failure that only
      // shows up as rare, unexplained anomalies under concurrency.
      throw new Error(
        'isolation and readOnly cannot be set on a nested transaction: they belong to the ' +
          'enclosing transaction, which has already begun. Set them at the outermost call.',
      );
    }
    return runNested(existing, fn, options.operation);
  }

  const attempts = Math.max(0, options.retries ?? 0) + 1;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await runOutermost(fn, options);
    } catch (error) {
      lastError = error;
      const cause = (error as { cause?: unknown }).cause;
      if (attempt < attempts && (isRetryable(cause) || isRetryable(error))) {
        // Exponential backoff with jitter: retrying a contended transaction
        // immediately, in lockstep with every other loser, reproduces the
        // contention that caused the failure.
        const backoff = Math.min(2 ** (attempt - 1) * 10, 200);
        await new Promise((resolve) => setTimeout(resolve, backoff + Math.random() * backoff));
        continue;
      }
      throw error;
    }
  }

  throw lastError;
}
