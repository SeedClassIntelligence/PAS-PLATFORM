/**
 * PAS-0002 — Environment Configuration
 *
 * "Configuration must validate on application startup."
 * "Applications must fail startup when required production configuration is invalid."
 *
 * `loadConfig` reads a flat environment source, maps it onto the twelve
 * categories, validates, and applies the deployment safety rules. It reports
 * EVERY problem at once rather than failing on the first — a startup that
 * surfaces one missing variable per restart is its own outage.
 */

import { z } from 'zod';
import { ValidationError, type FieldProblem } from '@pas/contracts';
import {
  type PasEnvironment,
  isPasEnvironment,
  isDeployedEnvironment,
  PAS_ENVIRONMENTS,
} from './environment.js';
import { buildConfigSchema, type PasConfig } from './schema.js';

export type EnvSource = Record<string, string | undefined>;

/**
 * A single configuration problem. Structurally the shared `FieldProblem`
 * from `@pas/contracts` — `path` is a dot-path into `PasConfig`, or the name
 * of the offending environment variable.
 */
export type ConfigProblem = FieldProblem;

/**
 * Thrown when configuration is invalid. Carries every problem found.
 *
 * Reconciled into the shared error contract at PAS-0003: this extends
 * `ValidationError`, so a configuration failure surfaced through an API
 * boundary (PAS-0005 readiness, for instance) serialises under the same rules
 * as every other PAS error — and, critically, has its details scrubbed before
 * reaching a client. A configuration error's details name environment
 * variables, which is exactly the shape of thing that should never be echoed
 * verbatim.
 */
export class ConfigValidationError extends ValidationError {
  readonly environment: PasEnvironment;

  constructor(environment: PasEnvironment, problems: readonly ConfigProblem[]) {
    const detail = problems.map((p) => `  • ${p.path}: ${p.message}`).join('\n');
    super(
      `PAS configuration is invalid for environment "${environment}" ` +
        `(${problems.length} problem${problems.length === 1 ? '' : 's'}):\n${detail}`,
      problems,
      { code: 'config.invalid' },
    );
    this.environment = environment;
  }
}

/**
 * Marker embedded in every built-in development secret. A deployed environment
 * that supplies a value containing this marker is rejected — it means an
 * example file was copied into production rather than real secrets provisioned.
 */
const DEVELOPMENT_SECRET_MARKER = 'not-for-deployment';

const SECRET_ENV_VARS = [
  'PAS_OBJECT_STORAGE_ACCESS_KEY_ID',
  'PAS_OBJECT_STORAGE_SECRET_ACCESS_KEY',
  'PAS_SESSION_SECRET',
  'PAS_ENCRYPTION_KEY',
] as const;

export function resolveEnvironment(env: EnvSource = process.env): PasEnvironment {
  const raw = env.PAS_ENV ?? env.NODE_ENV ?? 'development';
  if (!isPasEnvironment(raw)) {
    throw new ConfigValidationError('development', [
      {
        path: 'PAS_ENV',
        message: `"${raw}" is not a PAS environment. Expected one of: ${PAS_ENVIRONMENTS.join(', ')}.`,
      },
    ]);
  }
  return raw;
}

/** Collects PAS_AGENT_<PROVIDER>_API_KEY / _BASE_URL into keyed records. */
function collectAgentProviders(env: EnvSource) {
  const apiKeys: Record<string, string> = {};
  const baseUrls: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (!value) continue;
    const apiKeyMatch = /^PAS_AGENT_(.+)_API_KEY$/.exec(key);
    if (apiKeyMatch) {
      apiKeys[apiKeyMatch[1].toLowerCase()] = value;
      continue;
    }
    const baseUrlMatch = /^PAS_AGENT_(.+)_BASE_URL$/.exec(key);
    if (baseUrlMatch) {
      baseUrls[baseUrlMatch[1].toLowerCase()] = value;
    }
  }
  return { apiKeys, baseUrls };
}

/**
 * Drops absent keys so zod applies defaults rather than failing on undefined.
 *
 * An empty environment variable (`PAS_WORKER_CONCURRENCY=`) counts as absent.
 * Shells and orchestrators routinely produce empty strings for unset values,
 * and coercing "" to 0 would silently disable a worker pool.
 */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== ''),
  ) as Partial<T>;
}

function shapeFromEnv(env: EnvSource) {
  const agents = collectAgentProviders(env);
  return {
    database: compact({
      url: env.PAS_DATABASE_URL,
      poolMin: env.PAS_DATABASE_POOL_MIN,
      poolMax: env.PAS_DATABASE_POOL_MAX,
      ssl: env.PAS_DATABASE_SSL,
      statementTimeoutMs: env.PAS_DATABASE_STATEMENT_TIMEOUT_MS,
    }),
    objectStorage: compact({
      endpoint: env.PAS_OBJECT_STORAGE_ENDPOINT,
      region: env.PAS_OBJECT_STORAGE_REGION,
      bucket: env.PAS_OBJECT_STORAGE_BUCKET,
      accessKeyId: env.PAS_OBJECT_STORAGE_ACCESS_KEY_ID,
      secretAccessKey: env.PAS_OBJECT_STORAGE_SECRET_ACCESS_KEY,
      forcePathStyle: env.PAS_OBJECT_STORAGE_FORCE_PATH_STYLE,
      signedUrlTtlSeconds: env.PAS_OBJECT_STORAGE_SIGNED_URL_TTL_SECONDS,
    }),
    session: compact({
      secret: env.PAS_SESSION_SECRET,
      cookieName: env.PAS_SESSION_COOKIE_NAME,
      ttlSeconds: env.PAS_SESSION_TTL_SECONDS,
      cookieSecure: env.PAS_SESSION_COOKIE_SECURE,
      cookieSameSite: env.PAS_SESSION_COOKIE_SAME_SITE,
    }),
    authentication: compact({
      minPasswordLength: env.PAS_AUTH_MIN_PASSWORD_LENGTH,
      maxFailedAttempts: env.PAS_AUTH_MAX_FAILED_ATTEMPTS,
      lockoutSeconds: env.PAS_AUTH_LOCKOUT_SECONDS,
      passwordHashMemoryKiB: env.PAS_AUTH_PASSWORD_HASH_MEMORY_KIB,
      passwordHashIterations: env.PAS_AUTH_PASSWORD_HASH_ITERATIONS,
    }),
    encryption: compact({
      key: env.PAS_ENCRYPTION_KEY,
      keyVersion: env.PAS_ENCRYPTION_KEY_VERSION,
      algorithm: env.PAS_ENCRYPTION_ALGORITHM,
    }),
    publicUrl: env.PAS_PUBLIC_URL,
    apiUrl: env.PAS_API_URL,
    worker: compact({
      concurrency: env.PAS_WORKER_CONCURRENCY,
      pollIntervalMs: env.PAS_WORKER_POLL_INTERVAL_MS,
      maxAttempts: env.PAS_WORKER_MAX_ATTEMPTS,
      backoffBaseMs: env.PAS_WORKER_BACKOFF_BASE_MS,
      backoffMaxMs: env.PAS_WORKER_BACKOFF_MAX_MS,
      claimTimeoutMs: env.PAS_WORKER_CLAIM_TIMEOUT_MS,
    }),
    agentProviders: {
      ...compact({
        enabled: env.PAS_AGENT_ENABLED,
        defaultProvider: env.PAS_AGENT_DEFAULT_PROVIDER,
        requestTimeoutMs: env.PAS_AGENT_REQUEST_TIMEOUT_MS,
        maxRetries: env.PAS_AGENT_MAX_RETRIES,
      }),
      apiKeys: agents.apiKeys,
      baseUrls: agents.baseUrls,
    },
    observability: compact({
      logLevel: env.PAS_LOG_LEVEL,
      serviceName: env.PAS_SERVICE_NAME,
      tracingEnabled: env.PAS_TRACING_ENABLED,
      otlpEndpoint: env.PAS_OTLP_ENDPOINT,
      redactSecrets: env.PAS_REDACT_SECRETS,
    }),
    notification: compact({
      provider: env.PAS_NOTIFICATION_PROVIDER,
      fromAddress: env.PAS_NOTIFICATION_FROM_ADDRESS,
      smtpUrl: env.PAS_NOTIFICATION_SMTP_URL,
      apiKey: env.PAS_NOTIFICATION_API_KEY,
    }),
    rateLimiting: compact({
      enabled: env.PAS_RATE_LIMIT_ENABLED,
      windowMs: env.PAS_RATE_LIMIT_WINDOW_MS,
      maxRequests: env.PAS_RATE_LIMIT_MAX_REQUESTS,
      maxRequestsAuthenticated: env.PAS_RATE_LIMIT_MAX_REQUESTS_AUTHENTICATED,
    }),
    server: compact({
      apiPort: env.PAS_API_PORT,
      webPort: env.PAS_WEB_PORT,
    }),
  };
}

/**
 * Rules that cannot be expressed as a field schema because they depend on the
 * deployment classification rather than the value's own shape.
 */
function deploymentSafetyProblems(
  environment: PasEnvironment,
  config: z.infer<ReturnType<typeof buildConfigSchema>>,
  env: EnvSource,
): ConfigProblem[] {
  if (!isDeployedEnvironment(environment)) return [];
  const problems: ConfigProblem[] = [];

  for (const name of SECRET_ENV_VARS) {
    const value = env[name];
    if (value && value.includes(DEVELOPMENT_SECRET_MARKER)) {
      problems.push({
        path: name,
        message:
          'is a development placeholder. Provision a real secret — an example file ' +
          'appears to have been copied into a deployed environment.',
      });
    }
  }

  if (config.session.cookieSecure === false) {
    problems.push({
      path: 'session.cookieSecure',
      message: 'must be true in a deployed environment; session cookies would be sent over plaintext.',
    });
  }

  if (config.notification.provider === 'console') {
    problems.push({
      path: 'notification.provider',
      message: 'cannot be "console" in a deployed environment; notifications would be silently dropped.',
    });
  }

  if (config.rateLimiting.enabled === false) {
    problems.push({
      path: 'rateLimiting.enabled',
      message: 'must be true in a deployed environment (PAS-3603).',
    });
  }

  if (config.notification.provider === 'smtp' && !config.notification.smtpUrl) {
    problems.push({
      path: 'notification.smtpUrl',
      message: 'is required when notification.provider is "smtp".',
    });
  }

  if (config.notification.provider === 'http' && !config.notification.apiKey) {
    problems.push({
      path: 'notification.apiKey',
      message: 'is required when notification.provider is "http".',
    });
  }

  if (config.agentProviders.enabled && Object.keys(config.agentProviders.apiKeys).length === 0) {
    problems.push({
      path: 'agentProviders.apiKeys',
      message:
        'agentProviders.enabled is true but no PAS_AGENT_<PROVIDER>_API_KEY is set. ' +
        'The Agent Gateway would have no provider to route to (PAS-1601).',
    });
  }

  return problems;
}

/**
 * Loads, validates and returns the configuration.
 *
 * @throws ConfigValidationError listing every problem found.
 */
export function loadConfig(env: EnvSource = process.env): PasConfig {
  const environment = resolveEnvironment(env);
  const result = buildConfigSchema(environment).safeParse(shapeFromEnv(env));

  if (!result.success) {
    throw new ConfigValidationError(
      environment,
      result.error.issues.map((issue) => ({
        path: issue.path.join('.') || '(root)',
        message: issue.message,
      })),
    );
  }

  const safetyProblems = deploymentSafetyProblems(environment, result.data, env);
  if (safetyProblems.length > 0) {
    throw new ConfigValidationError(environment, safetyProblems);
  }

  return Object.freeze({ environment, ...result.data });
}

let cached: PasConfig | undefined;

/**
 * Validates once per process and caches. Call at application startup so an
 * invalid configuration fails before the process begins serving.
 */
export function getConfig(env: EnvSource = process.env): PasConfig {
  cached ??= loadConfig(env);
  return cached;
}

/** Test-only: clears the process-level cache. */
export function resetConfigCache(): void {
  cached = undefined;
}
