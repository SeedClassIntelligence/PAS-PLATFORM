/** PAS-0005 — Health and Readiness. */

export {
  type ReadinessCheck,
  type CheckResult,
  type CheckStatus,
  type ReadinessReport,
  DEFAULT_TIMEOUT_MS,
  registerReadinessCheck,
  unregisterReadinessCheck,
  registeredChecks,
  clearReadinessChecks,
  runReadinessChecks,
} from './checks.js';

export {
  type HealthResponse,
  type ReadyResponse,
  type HealthContext,
  type HandlerOutcome,
  handleHealth,
  handleReady,
} from './handlers.js';

export { registerConfigCheck } from './config-check.js';

export { registerDatabaseChecks, resetSchemaCheck } from './database-check.js';
