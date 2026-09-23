/**
 * `@pas/api` — the PAS API process.
 *
 * Owns synchronous API requests, authentication, authorization and
 * domain-service invocation. It does NOT own canonical business rules
 * (Clean-Sheet Part I §1).
 *
 * Implemented: PAS-0005 health and readiness.
 */

export { createApiServer, startApi, type StartedApi } from './server.js';
export * from './health/index.js';
