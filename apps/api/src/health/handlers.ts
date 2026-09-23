/**
 * PAS-0005 — Health and Readiness
 *
 * "GET /health indicates process health.
 *  GET /ready validates required dependencies such as database connectivity.
 *  Do not expose sensitive infrastructure details publicly."
 *
 * ── Liveness and readiness are different questions ────────────────────────
 *
 *   /health  Is this process alive and able to serve?
 *            It MUST NOT check dependencies. A liveness probe that checks the
 *            database restarts every pod the moment the database blips —
 *            turning a brief dependency outage into a full-fleet restart
 *            storm, at exactly the moment the database can least afford a
 *            reconnect stampede.
 *
 *   /ready   Should this process receive traffic right now?
 *            This is where dependencies are validated.
 *
 * During graceful shutdown the two deliberately disagree: `/health` stays 200
 * (do not kill me, I am finishing in-flight requests) while `/ready` returns
 * 503 (stop routing new traffic to me). Collapsing them loses zero-downtime
 * deploys.
 *
 * ── "Do not expose sensitive infrastructure details publicly" ─────────────
 *
 * The natural readiness response is a recon gift:
 *
 *     {"database":{"status":"fail","detail":"ECONNREFUSED 10.0.1.42:5432"}}
 *
 * Internal addressing, ports, service topology and driver versions, served
 * unauthenticated to anyone who can reach the endpoint. In a deployed
 * environment the public body is therefore the aggregate status and nothing
 * else — not even which check failed, since the set of check names is itself
 * a map of PAS's dependencies.
 */

import { type PasEnvironment, isDeployedEnvironment } from '@pas/config';
import { type CorrelationContext } from '@pas/observability';
import { runReadinessChecks, type CheckResult } from './checks.js';

export interface HealthResponse {
  status: 'ok' | 'shutting_down';
  correlationId: string;
}

export interface ReadyResponse {
  status: 'ready' | 'not_ready';
  correlationId: string;
  /** Present only outside deployed environments. See the module note. */
  checks?: readonly CheckResult[];
}

export interface HandlerOutcome<T> {
  httpStatus: number;
  body: T;
}

export interface HealthContext {
  environment: PasEnvironment;
  correlation: CorrelationContext;
  /** True once graceful shutdown has begun. */
  draining: boolean;
}

/**
 * Liveness. Answers from process state alone — no I/O, no dependencies.
 *
 * Returns 200 even while draining: the process is alive and finishing work,
 * and a 503 here invites the orchestrator to kill it mid-request.
 */
export function handleHealth(context: HealthContext): HandlerOutcome<HealthResponse> {
  return {
    httpStatus: 200,
    body: {
      status: context.draining ? 'shutting_down' : 'ok',
      correlationId: context.correlation.correlationId,
    },
  };
}

/**
 * Readiness. Runs every registered check.
 *
 * 503 when draining or when a critical check fails — the standard signal for
 * a load balancer to stop routing.
 */
export async function handleReady(context: HealthContext): Promise<HandlerOutcome<ReadyResponse>> {
  if (context.draining) {
    return {
      httpStatus: 503,
      body: { status: 'not_ready', correlationId: context.correlation.correlationId },
    };
  }

  const report = await runReadinessChecks();
  const deployed = isDeployedEnvironment(context.environment);

  return {
    httpStatus: report.ready ? 200 : 503,
    body: {
      status: report.ready ? 'ready' : 'not_ready',
      correlationId: context.correlation.correlationId,
      // Check names and failure details are withheld from deployed callers.
      // The HTTP status is the answer a probe needs; the rest is for operators,
      // and reaches them through logs, which carry the same correlation id.
      ...(deployed ? {} : { checks: report.checks }),
    },
  };
}
