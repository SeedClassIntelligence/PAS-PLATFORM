/**
 * PAS-0002 — Environment Configuration
 *
 * The twelve configuration categories PAS-0002 requires, as validated schemas.
 *
 * Every field below is traceable to a ticket that consumes it. Fields are not
 * added speculatively — a category carries what its named consumer needs and
 * nothing more. Later tickets extend their own category.
 *
 * Secrets are declared once in SECRET_PATHS (see redact.ts) and are never
 * printed, logged or serialised by this package.
 *
 * ── Three kinds of field ──────────────────────────────────────────────────
 *
 *   secret()           must be supplied explicitly when deployed; a marked
 *                      development placeholder is used otherwise.
 *   deployedRequired() environment-specific and unguessable (a database URL,
 *                      a bucket, a public origin). Required when deployed.
 *   always()           an operational setting with a sane universal default
 *                      (pool size, cookie name, timeout, log level). Never
 *                      required — optionally a different default when deployed.
 *
 * Conflating the last two makes production refuse to start over a cookie name,
 * which is noise that trains operators to ignore configuration errors.
 */

import { z } from 'zod';
import { type PasEnvironment, allowsDefaults } from './environment.js';

/** Must be supplied explicitly in deployed environments; min 32 chars there. */
function secret(environment: PasEnvironment, developmentDefault: string) {
  const base = z.string().min(1);
  return allowsDefaults(environment) ? base.default(developmentDefault) : z.string().min(32);
}

/** Environment-specific and unguessable: required when deployed. */
function deployedRequired<T extends z.ZodTypeAny>(
  environment: PasEnvironment,
  schema: T,
  developmentDefault: unknown,
) {
  return allowsDefaults(environment) ? schema.default(developmentDefault as never) : schema;
}

/** Operational setting: always defaulted, optionally differently when deployed. */
function always<T extends z.ZodTypeAny>(
  environment: PasEnvironment,
  schema: T,
  developmentDefault: unknown,
  deployedDefault?: unknown,
) {
  const chosen =
    !allowsDefaults(environment) && deployedDefault !== undefined
      ? deployedDefault
      : developmentDefault;
  return schema.default(chosen as never);
}

const port = z.coerce.number().int().min(1).max(65535);
const positiveInt = z.coerce.number().int().positive();
const url = z.string().url();

/**
 * Boolean parsed from an environment variable.
 *
 * NOT `z.coerce.boolean()`. That applies JavaScript `Boolean()`, under which
 * the string "false" is truthy — so `PAS_RATE_LIMIT_ENABLED=false` would be
 * read as **enabled**, and `PAS_AGENT_ENABLED=false` would switch the Agent
 * Gateway on. Environment variables are always strings, so the only correct
 * parse is an explicit one that rejects anything ambiguous.
 */
const TRUE_LITERALS = new Set(['true', '1', 'yes', 'on']);
const FALSE_LITERALS = new Set(['false', '0', 'no', 'off']);

const bool = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;
  const normalized = value.trim().toLowerCase();
  if (TRUE_LITERALS.has(normalized)) return true;
  if (FALSE_LITERALS.has(normalized)) return false;
  return value; // fall through to the boolean check, which reports the error
}, z.boolean({
  invalid_type_error:
    'must be one of: true, false, 1, 0, yes, no, on, off (case-insensitive)',
}));

export function buildConfigSchema(environment: PasEnvironment) {
  const req = <T extends z.ZodTypeAny>(schema: T, dev: unknown) =>
    deployedRequired(environment, schema, dev);
  const opt = <T extends z.ZodTypeAny>(schema: T, dev: unknown, deployed?: unknown) =>
    always(environment, schema, dev, deployed);

  return z.object({
    /** DATABASE — PAS-0101 connection pooling, PAS-0102 migrations. */
    database: z.object({
      url: req(z.string().min(1), 'postgresql://pas:pas@localhost:5432/pas_development'),
      poolMin: opt(z.coerce.number().int().min(0), 2),
      poolMax: opt(positiveInt, 10),
      ssl: opt(bool, false, true),
      statementTimeoutMs: opt(positiveInt, 30_000),
    }),

    /** OBJECT_STORAGE — PAS-0604 adapter, Part I §11 source binaries. */
    objectStorage: z.object({
      endpoint: req(url, 'http://localhost:9000'),
      region: req(z.string().min(1), 'us-east-1'),
      bucket: req(z.string().min(1), 'pas-sources-development'),
      accessKeyId: secret(environment, 'pas-development-access-key-not-for-deployment'),
      secretAccessKey: secret(environment, 'pas-development-secret-key-not-for-deployment'),
      /** MinIO and other S3-compatible stores require path-style addressing. */
      forcePathStyle: opt(bool, true, false),
      /** Part I §11: private source URLs must not become permanent public URLs. */
      signedUrlTtlSeconds: opt(positiveInt, 900),
    }),

    /** SESSION — PAS-0202 sessions. */
    session: z.object({
      secret: secret(environment, 'pas-development-session-secret-not-for-deployment'),
      cookieName: opt(z.string().min(1), 'pas_session'),
      ttlSeconds: opt(positiveInt, 60 * 60 * 12),
      /** Defaults true when deployed; an explicit false is rejected in load.ts. */
      cookieSecure: opt(bool, false, true),
      cookieSameSite: opt(z.enum(['strict', 'lax', 'none']), 'lax'),
    }),

    /** AUTHENTICATION — PAS-0202 authentication and authentication_events. */
    authentication: z.object({
      minPasswordLength: opt(z.coerce.number().int().min(8), 12),
      maxFailedAttempts: opt(positiveInt, 5),
      lockoutSeconds: opt(positiveInt, 900),
      /** argon2id memory cost (KiB) and iterations. */
      passwordHashMemoryKiB: opt(positiveInt, 19_456),
      passwordHashIterations: opt(positiveInt, 2),
    }),

    /** ENCRYPTION — at-rest encryption of sensitive stored values. */
    encryption: z.object({
      key: secret(environment, 'pas-development-encryption-key-not-for-deployment'),
      /** Supports key rotation: stored ciphertext records the version used. */
      keyVersion: opt(positiveInt, 1),
      algorithm: opt(z.enum(['aes-256-gcm']), 'aes-256-gcm'),
    }),

    /** PUBLIC_URL — public PAS delivery origin. PAS-2803 canonical URLs. */
    publicUrl: req(url, 'http://localhost:3000'),

    /** API_URL — PAS API origin. */
    apiUrl: req(url, 'http://localhost:4000'),

    /** WORKER — PAS-0304 outbox, PAS-0305 dispatcher, PAS-1303 idempotency. */
    worker: z.object({
      concurrency: opt(positiveInt, 4),
      pollIntervalMs: opt(positiveInt, 1_000),
      /** Outbox delivery attempts before DEAD_LETTER (PAS-0304). */
      maxAttempts: opt(positiveInt, 5),
      backoffBaseMs: opt(positiveInt, 1_000),
      backoffMaxMs: opt(positiveInt, 300_000),
      /** A claimed job not completed within this window is reclaimable. */
      claimTimeoutMs: opt(positiveInt, 300_000),
    }),

    /** AGENT_PROVIDERS — PAS-1601 gateway, PAS-1602 model registry. */
    agentProviders: z.object({
      /**
       * Gateway-level switch. PAS-1601: application code may not call provider
       * SDKs directly, so disabling this disables all model invocation.
       */
      enabled: opt(bool, false),
      defaultProvider: opt(z.string().min(1), 'none'),
      requestTimeoutMs: opt(positiveInt, 60_000),
      maxRetries: opt(z.coerce.number().int().min(0), 2),
      /**
       * Per-provider credentials keyed by provider identifier, from
       * PAS_AGENT_<PROVIDER>_API_KEY. Empty is valid: PAS must start with no
       * provider configured (PAS-1601 provider neutrality). No vendor name
       * appears in this schema.
       */
      apiKeys: z.record(z.string().min(1)).default({}),
      baseUrls: z.record(url).default({}),
    }),

    /** OBSERVABILITY — PAS-3606, PAS-0004 correlation propagation. */
    observability: z.object({
      logLevel: opt(z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']), 'debug', 'info'),
      serviceName: opt(z.string().min(1), 'pas-platform'),
      tracingEnabled: opt(bool, false),
      otlpEndpoint: url.optional(),
      /** PAS-0301: sensitive values must be redacted appropriately. */
      redactSecrets: opt(bool, true),
    }),

    /** EMAIL/NOTIFICATION — human task assignment, publication review. */
    notification: z.object({
      /** 'console' writes to the log instead of sending; rejected when deployed. */
      provider: opt(z.enum(['console', 'smtp', 'http']), 'console', 'smtp'),
      fromAddress: req(z.string().email(), 'pas@pas.local'),
      smtpUrl: z.string().min(1).optional(),
      apiKey: z.string().min(1).optional(),
    }),

    /** RATE_LIMITING — PAS-3603 API security. */
    rateLimiting: z.object({
      /** Off in development only; an explicit false is rejected when deployed. */
      enabled: opt(bool, false, true),
      windowMs: opt(positiveInt, 60_000),
      maxRequests: opt(positiveInt, 300),
      /** Authenticated callers get a separate, higher allowance. */
      maxRequestsAuthenticated: opt(positiveInt, 1_000),
    }),

    /** Process binding. */
    server: z.object({
      apiPort: opt(port, 4000),
      webPort: opt(port, 3000),
    }),
  });
}

export type PasConfigShape = z.infer<ReturnType<typeof buildConfigSchema>>;

export interface PasConfig extends PasConfigShape {
  environment: PasEnvironment;
}
