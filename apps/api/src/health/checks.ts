/**
 * PAS-0005 — Health and Readiness
 *
 * A registry of readiness checks.
 *
 * Checks register themselves rather than being enumerated here, so PAS-0101
 * adds the database check and PAS-0604 adds object storage without either
 * ticket touching the health endpoint. The alternative — a hardcoded list —
 * makes every new dependency an edit to a file nobody owns.
 */

import { scrubDetails } from '@pas/contracts';

export type CheckStatus = 'pass' | 'fail';

export interface CheckResult {
  name: string;
  status: CheckStatus;
  durationMs: number;
  /**
   * Operator-facing detail. NEVER returned to a public caller in a deployed
   * environment — see `handlers.ts`. Scrubbed on the way out regardless.
   */
  detail?: string;
}

export interface ReadinessCheck {
  name: string;
  /**
   * `true` when a failure means the process must not receive traffic.
   * A non-critical failure is reported but does not fail readiness — an
   * optional dependency being down should degrade, not black-hole the service.
   */
  critical: boolean;
  /** Per-check ceiling. See `DEFAULT_TIMEOUT_MS`. */
  timeoutMs?: number;
  run(): Promise<void> | void;
}

/**
 * A readiness probe that hangs is worse than one that fails: the orchestrator
 * sees no answer, assumes the worst, and kills a process that may be healthy.
 * Every check is raced against a timeout so the endpoint always answers.
 */
export const DEFAULT_TIMEOUT_MS = 2_000;

const registry = new Map<string, ReadinessCheck>();

export function registerReadinessCheck(check: ReadinessCheck): void {
  registry.set(check.name, check);
}

export function unregisterReadinessCheck(name: string): void {
  registry.delete(name);
}

export function registeredChecks(): readonly ReadinessCheck[] {
  return [...registry.values()];
}

/** Test-only: empties the registry. */
export function clearReadinessChecks(): void {
  registry.clear();
}

async function withTimeout(check: ReadinessCheck): Promise<void> {
  const ms = check.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(() => check.run()),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
        // Do not hold the event loop open on a pending health check.
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  // A driver error's message is a prime carrier of connection strings.
  return String(scrubDetails(message));
}

export interface ReadinessReport {
  ready: boolean;
  checks: readonly CheckResult[];
}

/** Runs every registered check concurrently. Never throws. */
export async function runReadinessChecks(): Promise<ReadinessReport> {
  const checks = registeredChecks();

  const results = await Promise.all(
    checks.map(async (check): Promise<CheckResult> => {
      const started = Date.now();
      try {
        await withTimeout(check);
        return { name: check.name, status: 'pass', durationMs: Date.now() - started };
      } catch (error) {
        return {
          name: check.name,
          status: 'fail',
          durationMs: Date.now() - started,
          detail: describe(error),
        };
      }
    }),
  );

  const critical = new Map(checks.map((c) => [c.name, c.critical]));
  const ready = results.every((r) => r.status === 'pass' || critical.get(r.name) === false);

  return { ready, checks: results };
}
