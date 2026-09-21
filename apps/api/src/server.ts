/**
 * PAS-0005 — the PAS API process.
 *
 * ── Why `node:http` and not a framework ───────────────────────────────────
 *
 * PAS-0005 needs two GET endpoints. Choosing Fastify, Express or Hono to serve
 * them would settle the framework for every subsequent endpoint ticket on the
 * basis of a requirement that exercises none of what a framework provides —
 * routing depth, body parsing, schema validation, middleware composition.
 *
 * The decision is deferred to PAS-0405 (the first domain API), where those
 * actually matter and the choice can be made against real requirements. Until
 * then this file is ~120 lines of standard library with no runtime dependency,
 * and moving these two routes onto a framework later is trivial.
 *
 * Recommendation recorded for that ticket, not acted on here: Fastify —
 * first-class TypeScript, JSON-schema validation that composes with the zod
 * contracts already in `@pas/contracts`, and a plugin model that matches the
 * modular monolith of §XLIII.
 */

import { createServer, type IncomingMessage, type ServerResponse, type Server } from 'node:http';
import { getConfig, isDeployedEnvironment, type PasConfig } from '@pas/config';
import {
  contextFromHeaders,
  runWithContext,
  responseCorrelationHeaders,
  type CorrelationContext,
} from '@pas/observability';
import { toErrorResponse } from '@pas/contracts';
import { handleHealth, handleReady, registerConfigCheck, registerDatabaseChecks } from './health/index.js';
import { closePool } from '@pas/database';

/** Mutable process state. `draining` flips at the start of graceful shutdown. */
interface ProcessState {
  draining: boolean;
}

function writeJson(
  response: ServerResponse,
  httpStatus: number,
  body: unknown,
  context: CorrelationContext,
): void {
  const payload = JSON.stringify(body);
  response.writeHead(httpStatus, {
    'content-type': 'application/json; charset=utf-8',
    // A cached health response reports the state of a past moment, which is
    // the one thing a probe must never act on.
    'cache-control': 'no-store, no-cache, must-revalidate',
    ...responseCorrelationHeaders(context),
  });
  response.end(payload);
}

export function createApiServer(config: PasConfig, state: ProcessState = { draining: false }): Server {
  return createServer((request: IncomingMessage, response: ServerResponse) => {
    const context = contextFromHeaders(request.headers, {
      kind: 'http',
      name: `${request.method ?? 'GET'} ${request.url ?? '/'}`,
    });

    void runWithContext(context, async () => {
      try {
        const path = (request.url ?? '/').split('?')[0];
        const method = request.method ?? 'GET';

        // Health and readiness are probes: unauthenticated by necessity, since
        // an orchestrator has no credentials. That is exactly why their bodies
        // are minimal in a deployed environment.
        if (method === 'GET' && path === '/health') {
          const { httpStatus, body } = handleHealth({
            environment: config.environment,
            correlation: context,
            draining: state.draining,
          });
          return writeJson(response, httpStatus, body, context);
        }

        if (method === 'GET' && path === '/ready') {
          const { httpStatus, body } = await handleReady({
            environment: config.environment,
            correlation: context,
            draining: state.draining,
          });
          return writeJson(response, httpStatus, body, context);
        }

        return writeJson(
          response,
          404,
          {
            error: {
              code: 'resource.not_found',
              message: 'Not found.',
              family: 'NOT_FOUND',
              correlationId: context.correlationId,
            },
          },
          context,
        );
      } catch (error) {
        // PAS-0003 owns what a client may see. Nothing is formatted here.
        const body = toErrorResponse(error, {
          correlationId: context.correlationId,
          deployed: isDeployedEnvironment(config.environment),
        });
        return writeJson(response, 500, body, context);
      }
    });
  });
}

export interface StartedApi {
  server: Server;
  /** Flips readiness to 503, then closes once in-flight requests finish. */
  shutdown(): Promise<void>;
}

/**
 * Starts the API.
 *
 * Configuration is resolved first and deliberately not caught: PAS-0002
 * requires the process to fail startup when deployed configuration is invalid.
 * A server that binds a port before knowing it is configured is a server that
 * serves errors instead of refusing to exist.
 */
export function startApi(): StartedApi {
  const config = getConfig();
  registerConfigCheck();
  // PAS-0102. The pool is lazy, so this does not connect at startup — it makes
  // /ready refuse traffic until the database is reachable AND carries the
  // schema this build expects.
  registerDatabaseChecks();

  const state: ProcessState = { draining: false };
  const server = createApiServer(config, state);
  server.listen(config.server.apiPort);

  const shutdown = async (): Promise<void> => {
    // Fail readiness first so the load balancer stops routing, then close.
    state.draining = true;
    await new Promise<void>((resolve) => server.close(() => resolve()));
    // Release pooled connections last. Doing it before the server closes would
    // fail in-flight requests that are still holding one.
    await closePool();
  };

  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    process.once(signal, () => {
      void shutdown().then(() => process.exit(0));
    });
  }

  return { server, shutdown };
}
