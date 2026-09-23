/**
 * `@pas/config` — PAS-0002 Environment Configuration.
 *
 * Centralized, validated configuration for every PAS application. Applications
 * call `getConfig()` at startup; an invalid deployed configuration throws
 * before the process begins serving.
 *
 * This package has no workspace dependencies, per PAS-0001's declared
 * dependency direction. It is a leaf.
 */

export {
  PAS_ENVIRONMENTS,
  type PasEnvironment,
  isPasEnvironment,
  isDeployedEnvironment,
  allowsDefaults,
} from './environment.js';

export { buildConfigSchema, type PasConfig, type PasConfigShape } from './schema.js';

export {
  loadConfig,
  getConfig,
  resetConfigCache,
  resolveEnvironment,
  ConfigValidationError,
  type ConfigProblem,
  type EnvSource,
} from './load.js';

export { redactConfig, REDACTED, SECRET_PATHS } from './redact.js';
