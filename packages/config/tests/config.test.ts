/**
 * PAS-0002 acceptance tests.
 *
 * The load-bearing requirement is the last line of the ticket:
 * "Applications must fail startup when required production configuration is
 * invalid." Most of this file exercises that.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationError, isPasError, toErrorResponse } from '@pas/contracts';
import {
  loadConfig,
  getConfig,
  resetConfigCache,
  resolveEnvironment,
  ConfigValidationError,
  redactConfig,
  REDACTED,
  PAS_ENVIRONMENTS,
  isDeployedEnvironment,
  type EnvSource,
} from '../src/index.js';

/** A deployed environment with every required value supplied correctly. */
function validProductionEnv(overrides: EnvSource = {}): EnvSource {
  return {
    PAS_ENV: 'production',
    PAS_DATABASE_URL: 'postgresql://pas:realpassword@db.internal:5432/pas',
    PAS_OBJECT_STORAGE_ENDPOINT: 'https://storage.internal',
    PAS_OBJECT_STORAGE_REGION: 'us-west-2',
    PAS_OBJECT_STORAGE_BUCKET: 'pas-sources',
    PAS_OBJECT_STORAGE_ACCESS_KEY_ID: 'A'.repeat(32),
    PAS_OBJECT_STORAGE_SECRET_ACCESS_KEY: 'B'.repeat(40),
    PAS_SESSION_SECRET: 'C'.repeat(48),
    PAS_ENCRYPTION_KEY: 'D'.repeat(44),
    PAS_PUBLIC_URL: 'https://pasplatform.com',
    PAS_API_URL: 'https://api.pasplatform.com',
    PAS_NOTIFICATION_PROVIDER: 'smtp',
    PAS_NOTIFICATION_FROM_ADDRESS: 'pas@pasplatform.com',
    PAS_NOTIFICATION_SMTP_URL: 'smtps://mail.internal:465',
    ...overrides,
  };
}

beforeEach(() => resetConfigCache());

describe('environments', () => {
  it('supports exactly the four PAS-0002 environments', () => {
    expect([...PAS_ENVIRONMENTS]).toEqual(['development', 'test', 'staging', 'production']);
  });

  it('classifies staging and production as deployed', () => {
    expect(isDeployedEnvironment('production')).toBe(true);
    expect(isDeployedEnvironment('staging')).toBe(true);
    expect(isDeployedEnvironment('development')).toBe(false);
    expect(isDeployedEnvironment('test')).toBe(false);
  });

  it('defaults to development and honours PAS_ENV over NODE_ENV', () => {
    expect(resolveEnvironment({})).toBe('development');
    expect(resolveEnvironment({ NODE_ENV: 'production' })).toBe('production');
    expect(resolveEnvironment({ NODE_ENV: 'production', PAS_ENV: 'staging' })).toBe('staging');
  });

  it('rejects an unknown environment name', () => {
    expect(() => resolveEnvironment({ PAS_ENV: 'prod' })).toThrow(ConfigValidationError);
  });
});

describe('development', () => {
  it('starts with no configuration at all', () => {
    const config = loadConfig({});
    expect(config.environment).toBe('development');
    expect(config.database.url).toContain('localhost');
    expect(config.agentProviders.enabled).toBe(false);
  });

  it('populates all twelve required categories', () => {
    const config = loadConfig({});
    for (const category of [
      'database',
      'objectStorage',
      'session',
      'authentication',
      'encryption',
      'publicUrl',
      'apiUrl',
      'worker',
      'agentProviders',
      'observability',
      'notification',
      'rateLimiting',
    ] as const) {
      expect(config[category], `missing category: ${category}`).toBeDefined();
    }
  });

  it('coerces numeric and boolean strings from the environment', () => {
    const config = loadConfig({ PAS_WORKER_CONCURRENCY: '16', PAS_TRACING_ENABLED: 'true' });
    expect(config.worker.concurrency).toBe(16);
    expect(config.observability.tracingEnabled).toBe(true);
  });

  it('returns a frozen object', () => {
    const config = loadConfig({});
    expect(Object.isFrozen(config)).toBe(true);
  });
});

describe('production fail-fast', () => {
  it('accepts a fully-specified production configuration', () => {
    const config = loadConfig(validProductionEnv());
    expect(config.environment).toBe('production');
    expect(config.session.cookieSecure).toBe(true);
    expect(config.rateLimiting.enabled).toBe(true);
    expect(config.database.ssl).toBe(true);
  });

  it('fails when required secrets are absent', () => {
    expect(() => loadConfig({ PAS_ENV: 'production' })).toThrow(ConfigValidationError);
  });

  it('reports every problem at once, not just the first', () => {
    try {
      loadConfig({ PAS_ENV: 'production' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      const problems = (error as ConfigValidationError).problems;
      expect(problems.length).toBeGreaterThan(3);
      const paths = problems.map((p) => p.path);
      expect(paths).toContain('session.secret');
      expect(paths).toContain('encryption.key');
    }
  });

  it('rejects a development placeholder secret copied into production', () => {
    const env = validProductionEnv({
      PAS_SESSION_SECRET: 'pas-development-session-secret-not-for-deployment',
    });
    try {
      loadConfig(env);
      expect.unreachable('should have thrown');
    } catch (error) {
      const problems = (error as ConfigValidationError).problems;
      expect(problems.some((p) => p.path === 'PAS_SESSION_SECRET')).toBe(true);
    }
  });

  it('rejects short secrets in deployed environments', () => {
    expect(() => loadConfig(validProductionEnv({ PAS_SESSION_SECRET: 'short' }))).toThrow(
      ConfigValidationError,
    );
  });

  it('refuses insecure session cookies', () => {
    const env = validProductionEnv({ PAS_SESSION_COOKIE_SECURE: 'false' });
    try {
      loadConfig(env);
      expect.unreachable('should have thrown');
    } catch (error) {
      const paths = (error as ConfigValidationError).problems.map((p) => p.path);
      expect(paths).toContain('session.cookieSecure');
    }
  });

  it('refuses the console notification provider', () => {
    const env = validProductionEnv({ PAS_NOTIFICATION_PROVIDER: 'console' });
    try {
      loadConfig(env);
      expect.unreachable('should have thrown');
    } catch (error) {
      const paths = (error as ConfigValidationError).problems.map((p) => p.path);
      expect(paths).toContain('notification.provider');
    }
  });

  it('refuses disabled rate limiting (PAS-3603)', () => {
    const env = validProductionEnv({ PAS_RATE_LIMIT_ENABLED: 'false' });
    try {
      loadConfig(env);
      expect.unreachable('should have thrown');
    } catch (error) {
      const paths = (error as ConfigValidationError).problems.map((p) => p.path);
      expect(paths).toContain('rateLimiting.enabled');
    }
  });

  it('refuses an enabled Agent Gateway with no provider credentials (PAS-1601)', () => {
    const env = validProductionEnv({ PAS_AGENT_ENABLED: 'true' });
    try {
      loadConfig(env);
      expect.unreachable('should have thrown');
    } catch (error) {
      const paths = (error as ConfigValidationError).problems.map((p) => p.path);
      expect(paths).toContain('agentProviders.apiKeys');
    }
  });

  it('applies the same rules to staging', () => {
    expect(() => loadConfig({ PAS_ENV: 'staging' })).toThrow(ConfigValidationError);
  });
});

describe('environment boolean parsing', () => {
  /**
   * Regression: `z.coerce.boolean()` applies JavaScript `Boolean()`, under
   * which the string "false" is TRUTHY. That would have made
   * PAS_RATE_LIMIT_ENABLED=false mean enabled, and PAS_AGENT_ENABLED=false
   * switch the Agent Gateway ON. Caught by the deployment-safety tests.
   */
  it('reads "false" as false, not as a truthy string', () => {
    expect(loadConfig({ PAS_AGENT_ENABLED: 'false' }).agentProviders.enabled).toBe(false);
    expect(loadConfig({ PAS_RATE_LIMIT_ENABLED: 'false' }).rateLimiting.enabled).toBe(false);
    expect(loadConfig({ PAS_TRACING_ENABLED: 'false' }).observability.tracingEnabled).toBe(false);
  });

  it('accepts the usual environment-variable spellings, case-insensitively', () => {
    for (const truthy of ['true', 'TRUE', '1', 'yes', 'on', ' True ']) {
      expect(loadConfig({ PAS_AGENT_ENABLED: truthy }).agentProviders.enabled, truthy).toBe(true);
    }
    for (const falsy of ['false', 'FALSE', '0', 'no', 'off', ' False ']) {
      expect(loadConfig({ PAS_AGENT_ENABLED: falsy }).agentProviders.enabled, falsy).toBe(false);
    }
  });

  it('rejects an ambiguous boolean rather than guessing', () => {
    expect(() => loadConfig({ PAS_AGENT_ENABLED: 'maybe' })).toThrow(ConfigValidationError);
  });

  it('treats an empty variable as absent so the default applies', () => {
    const config = loadConfig({ PAS_WORKER_CONCURRENCY: '', PAS_SERVICE_NAME: '' });
    expect(config.worker.concurrency).toBe(4);
    expect(config.observability.serviceName).toBe('pas-platform');
  });
});

describe('operational defaults are never required', () => {
  /**
   * Regression: an earlier design required every non-secret field explicitly in
   * deployed environments, so production refused to start over a missing cookie
   * name. Operational settings with sane universal defaults must default
   * everywhere; only secrets and environment-specific values are required.
   */
  it('does not require operational settings in production', () => {
    const config = loadConfig(validProductionEnv());
    expect(config.session.cookieName).toBe('pas_session');
    expect(config.observability.serviceName).toBe('pas-platform');
    expect(config.encryption.algorithm).toBe('aes-256-gcm');
    expect(config.database.poolMin).toBe(2);
    expect(config.worker.concurrency).toBe(4);
  });

  it('reports only genuinely missing values when production is unconfigured', () => {
    try {
      loadConfig({ PAS_ENV: 'production' });
      expect.unreachable('should have thrown');
    } catch (error) {
      const paths = (error as ConfigValidationError).problems.map((p) => p.path);
      // secrets and environment-specific values: required
      expect(paths).toContain('session.secret');
      expect(paths).toContain('database.url');
      expect(paths).toContain('publicUrl');
      // operational settings: never required
      expect(paths).not.toContain('session.cookieName');
      expect(paths).not.toContain('observability.serviceName');
      expect(paths).not.toContain('database.poolMin');
    }
  });
});

describe('agent providers (PAS-1601/1602)', () => {
  it('collects per-provider credentials without naming a vendor in the schema', () => {
    const config = loadConfig(
      validProductionEnv({
        PAS_AGENT_ENABLED: 'true',
        PAS_AGENT_DEFAULT_PROVIDER: 'anthropic',
        PAS_AGENT_ANTHROPIC_API_KEY: 'key-anthropic',
        PAS_AGENT_OPENAI_API_KEY: 'key-openai',
        PAS_AGENT_LOCAL_BASE_URL: 'http://localhost:11434',
      }),
    );
    expect(Object.keys(config.agentProviders.apiKeys).sort()).toEqual(['anthropic', 'openai']);
    expect(config.agentProviders.baseUrls.local).toBe('http://localhost:11434');
  });

  it('starts with no provider configured', () => {
    const config = loadConfig({});
    expect(config.agentProviders.apiKeys).toEqual({});
    expect(config.agentProviders.enabled).toBe(false);
  });
});

describe('secret redaction (PAS-0301)', () => {
  it('redacts every declared secret and nothing else', () => {
    const config = loadConfig(validProductionEnv({ PAS_AGENT_ANTHROPIC_API_KEY: 'key-secret' }));
    const safe = redactConfig(config) as unknown as Record<string, Record<string, unknown>>;

    expect(safe.database).toMatchObject({ url: REDACTED });
    expect(safe.objectStorage).toMatchObject({
      accessKeyId: REDACTED,
      secretAccessKey: REDACTED,
      bucket: 'pas-sources',
    });
    expect(safe.session).toMatchObject({ secret: REDACTED, cookieName: 'pas_session' });
    expect(safe.encryption).toMatchObject({ key: REDACTED, keyVersion: 1 });
    expect(safe.agentProviders).toMatchObject({ apiKeys: { anthropic: REDACTED } });
    expect(safe.notification).toMatchObject({ smtpUrl: REDACTED });
    expect(safe.environment).toBe('production');
  });

  it('leaves no secret value anywhere in the serialised output', () => {
    const config = loadConfig(validProductionEnv({ PAS_AGENT_ANTHROPIC_API_KEY: 'k'.repeat(30) }));
    const serialised = JSON.stringify(redactConfig(config));
    for (const secret of [
      'realpassword',
      'A'.repeat(32),
      'B'.repeat(40),
      'C'.repeat(48),
      'D'.repeat(44),
      'k'.repeat(30),
      'smtps://mail.internal:465',
    ]) {
      expect(serialised, `leaked: ${secret.slice(0, 12)}…`).not.toContain(secret);
    }
  });

  it('does not mutate the source configuration', () => {
    const config = loadConfig(validProductionEnv());
    redactConfig(config);
    expect(config.session.secret).toBe('C'.repeat(48));
  });
});

describe('getConfig caching', () => {
  it('validates once and returns the same instance', () => {
    const first = getConfig({ PAS_SERVICE_NAME: 'pas-test' });
    const second = getConfig({ PAS_SERVICE_NAME: 'ignored-after-first-call' });
    expect(second).toBe(first);
    expect(second.observability.serviceName).toBe('pas-test');
  });
});

describe('shared error contract reconciliation (PAS-0003)', () => {
  it('ConfigValidationError is a ValidationError in the shared contract', () => {
    try {
      loadConfig({ PAS_ENV: 'production' });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect(error).toBeInstanceOf(ValidationError);
      expect(isPasError(error)).toBe(true);
      expect((error as ConfigValidationError).family).toBe('VALIDATION');
      expect((error as ConfigValidationError).code).toBe('config.invalid');
      expect((error as ConfigValidationError).httpStatus).toBe(400);
    }
  });

  it('carries its problems as shared FieldProblems', () => {
    try {
      loadConfig({ PAS_ENV: 'production' });
      expect.unreachable('should have thrown');
    } catch (error) {
      const e = error as ConfigValidationError;
      expect(e.problems).toBe(e.problems);
      expect(e.problems.length).toBeGreaterThan(0);
      for (const problem of e.problems) {
        expect(problem).toHaveProperty('path');
        expect(problem).toHaveProperty('message');
      }
    }
  });

  it('serialises through the shared boundary without echoing a supplied secret', () => {
    try {
      loadConfig(validProductionEnv({ PAS_SESSION_SECRET: 'short-but-real-looking-secret' }));
      expect.unreachable('should have thrown');
    } catch (error) {
      const body = JSON.stringify(
        toErrorResponse(error, { correlationId: 'corr-1', deployed: true }),
      );
      expect(body).toContain('config.invalid');
      expect(body).toContain('corr-1');
      // the problem names the path, never the rejected value
      expect(body).not.toContain('short-but-real-looking-secret');
    }
  });
});
