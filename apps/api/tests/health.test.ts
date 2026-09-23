/**
 * PAS-0005 acceptance tests.
 *
 * The load-bearing requirement is the last line of the ticket: "Do not expose
 * sensitive infrastructure details publicly." The leak-prevention group runs a
 * real server with a deliberately hostile check and inspects the wire bytes.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { loadConfig, type PasConfig, type EnvSource } from '@pas/config';
import { CORRELATION_HEADER, isValidId } from '@pas/observability';
import {
  createApiServer,
  registerReadinessCheck,
  clearReadinessChecks,
  runReadinessChecks,
  registeredChecks,
  handleHealth,
  handleReady,
  registerConfigCheck,
  DEFAULT_TIMEOUT_MS,
} from '../src/index.js';

function productionEnv(overrides: EnvSource = {}): EnvSource {
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

/** A failure message shaped exactly like a real driver error. */
const HOSTILE_DETAIL =
  'connect ECONNREFUSED 10.0.1.42:5432 — postgresql://pas:hunter2@db.internal:5432/pas_production';

let server: Server | undefined;
const state = { draining: false };

async function listen(config: PasConfig): Promise<string> {
  state.draining = false;
  server = createApiServer(config, state);
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

beforeEach(() => clearReadinessChecks());

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = undefined;
  }
  clearReadinessChecks();
});

describe('the two required endpoints', () => {
  it('serves GET /health', async () => {
    const base = await listen(loadConfig({}));
    const response = await fetch(`${base}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok' });
  });

  it('serves GET /ready', async () => {
    const base = await listen(loadConfig({}));
    const response = await fetch(`${base}/ready`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ready' });
  });

  it('returns a typed 404 for anything else', async () => {
    const base = await listen(loadConfig({}));
    const response = await fetch(`${base}/admin`);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { family: 'NOT_FOUND' } });
  });

  it('never caches a health response', async () => {
    const base = await listen(loadConfig({}));
    for (const path of ['/health', '/ready']) {
      const response = await fetch(`${base}${path}`);
      expect(response.headers.get('cache-control'), path).toContain('no-store');
    }
  });
});

describe('liveness must not check dependencies', () => {
  /**
   * A liveness probe that checks the database restarts every pod the moment
   * the database blips — converting a brief dependency outage into a
   * fleet-wide restart storm, exactly when the database can least afford a
   * reconnect stampede.
   */
  it('stays 200 while a critical dependency is failing', async () => {
    registerReadinessCheck({
      name: 'database',
      critical: true,
      run: () => {
        throw new Error(HOSTILE_DETAIL);
      },
    });
    const base = await listen(loadConfig({}));

    expect((await fetch(`${base}/health`)).status).toBe(200);
    expect((await fetch(`${base}/ready`)).status).toBe(503);
  });

  it('runs no registered check at all', async () => {
    let ran = false;
    registerReadinessCheck({ name: 'spy', critical: true, run: () => void (ran = true) });
    const base = await listen(loadConfig({}));
    await fetch(`${base}/health`);
    expect(ran).toBe(false);
  });
});

describe('readiness validates dependencies', () => {
  it('fails when a critical check fails', async () => {
    registerReadinessCheck({ name: 'database', critical: true, run: () => { throw new Error('down'); } });
    const base = await listen(loadConfig({}));
    const response = await fetch(`${base}/ready`);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: 'not_ready' });
  });

  it('stays ready when a NON-critical check fails', async () => {
    // An optional dependency being down should degrade, not black-hole traffic.
    registerReadinessCheck({ name: 'optional', critical: false, run: () => { throw new Error('down'); } });
    const base = await listen(loadConfig({}));
    expect((await fetch(`${base}/ready`)).status).toBe(200);
  });

  it('times out a hanging check rather than hanging the probe', async () => {
    // A probe that never answers is worse than one that fails: the
    // orchestrator assumes the worst and kills a possibly-healthy process.
    registerReadinessCheck({
      name: 'wedged',
      critical: true,
      timeoutMs: 30,
      run: () => new Promise(() => {}),
    });
    const started = Date.now();
    const report = await runReadinessChecks();
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(report.ready).toBe(false);
    expect(report.checks[0].detail).toContain('timed out');
  });

  it('has a default timeout so a check cannot hang forever by omission', () => {
    expect(DEFAULT_TIMEOUT_MS).toBeGreaterThan(0);
    expect(DEFAULT_TIMEOUT_MS).toBeLessThanOrEqual(5_000);
  });

  it('runs checks concurrently, not in series', async () => {
    for (const name of ['a', 'b', 'c']) {
      registerReadinessCheck({
        name,
        critical: true,
        run: () => new Promise((resolve) => setTimeout(resolve, 60)),
      });
    }
    const started = Date.now();
    await runReadinessChecks();
    expect(Date.now() - started).toBeLessThan(150); // series would be ~180ms
  });
});

describe('checks self-register (PAS-0101 and PAS-0604 add their own)', () => {
  it('reports every registered check', async () => {
    registerReadinessCheck({ name: 'database', critical: true, run: () => {} });
    registerReadinessCheck({ name: 'object-storage', critical: true, run: () => {} });
    expect(registeredChecks().map((c) => c.name).sort()).toEqual(['database', 'object-storage']);
    const report = await runReadinessChecks();
    expect(report.checks).toHaveLength(2);
    expect(report.ready).toBe(true);
  });

  it('is ready with no checks registered', async () => {
    expect((await runReadinessChecks()).ready).toBe(true);
  });
});

describe('do not expose sensitive infrastructure details publicly', () => {
  it('withholds check names and details from a deployed caller', async () => {
    registerReadinessCheck({
      name: 'database',
      critical: true,
      run: () => {
        throw new Error(HOSTILE_DETAIL);
      },
    });
    const base = await listen(loadConfig(productionEnv()));
    const response = await fetch(`${base}/ready`);
    const raw = await response.text();

    expect(response.status).toBe(503);

    for (const secret of [
      '10.0.1.42',
      'db.internal',
      'hunter2',
      '5432',
      'ECONNREFUSED',
      'postgresql://',
      'pas_production',
      'database', // the check NAME is itself a map of PAS's dependencies
    ]) {
      expect(raw, `leaked: ${secret}`).not.toContain(secret);
    }

    expect(JSON.parse(raw)).toEqual({
      status: 'not_ready',
      correlationId: expect.any(String),
    });
  });

  it('withholds details in staging too, not only production', async () => {
    registerReadinessCheck({
      name: 'database',
      critical: true,
      run: () => {
        throw new Error(HOSTILE_DETAIL);
      },
    });
    const base = await listen(loadConfig(productionEnv({ PAS_ENV: 'staging' })));
    const raw = await (await fetch(`${base}/ready`)).text();
    expect(raw).not.toContain('db.internal');
    expect(raw).not.toContain('hunter2');
  });

  it('gives operators the detail outside a deployed environment', async () => {
    registerReadinessCheck({
      name: 'database',
      critical: true,
      run: () => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:5432');
      },
    });
    const base = await listen(loadConfig({}));
    const body = (await (await fetch(`${base}/ready`)).json()) as {
      checks: { name: string; status: string; detail?: string }[];
    };
    expect(body.checks).toHaveLength(1);
    expect(body.checks[0]).toMatchObject({ name: 'database', status: 'fail' });
    expect(body.checks[0].detail).toContain('ECONNREFUSED');
  });

  it('scrubs a credential even in the operator-facing detail', async () => {
    // Development detail is still written to a terminal, a CI log and a
    // screenshot in a bug report.
    registerReadinessCheck({
      name: 'database',
      critical: true,
      run: () => {
        throw new Error('auth failed for postgresql://pas:hunter2@localhost:5432/pas');
      },
    });
    const report = await runReadinessChecks();
    expect(report.checks[0].detail).not.toContain('hunter2');
  });

  it('leaks nothing when a check throws a non-Error', async () => {
    registerReadinessCheck({
      name: 'database',
      critical: true,
      run: () => {
        throw { secretAccessKey: 'B'.repeat(40), host: 'db.internal' };
      },
    });
    const base = await listen(loadConfig(productionEnv()));
    const raw = await (await fetch(`${base}/ready`)).text();
    expect(raw).not.toContain('db.internal');
    expect(raw).not.toContain('B'.repeat(40));
  });

  it('never returns a stack trace', async () => {
    registerReadinessCheck({
      name: 'database',
      critical: true,
      run: () => {
        throw new Error('boom');
      },
    });
    for (const env of [loadConfig({}), loadConfig(productionEnv())]) {
      const base = await listen(env);
      const raw = await (await fetch(`${base}/ready`)).text();
      expect(raw).not.toContain('    at ');
      expect(raw).not.toContain('.ts:');
      if (server) {
        await new Promise<void>((resolve) => server!.close(() => resolve()));
        server = undefined;
      }
    }
  });
});

describe('correlation (PAS-0004)', () => {
  it('returns a correlation id in body and header', async () => {
    const base = await listen(loadConfig({}));
    const response = await fetch(`${base}/health`);
    const body = (await response.json()) as { correlationId: string };
    expect(isValidId(body.correlationId)).toBe(true);
    expect(response.headers.get(CORRELATION_HEADER)).toBe(body.correlationId);
  });

  it('continues a chain begun upstream', async () => {
    const base = await listen(loadConfig({}));
    const response = await fetch(`${base}/health`, {
      headers: { [CORRELATION_HEADER]: 'corr_upstream' },
    });
    expect(((await response.json()) as { correlationId: string }).correlationId).toBe(
      'corr_upstream',
    );
  });

  it('neutralises a hostile inbound correlation header', async () => {
    const base = await listen(loadConfig({}));
    const response = await fetch(`${base}/health`, {
      headers: { [CORRELATION_HEADER]: 'x_2026-01-01_INFO_Payment_approved_x'.repeat(10) },
    });
    const body = (await response.json()) as { correlationId: string };
    expect(isValidId(body.correlationId)).toBe(true);
    expect(body.correlationId).not.toContain('Payment');
  });

  it('gives concurrent requests distinct correlation ids', async () => {
    const base = await listen(loadConfig({}));
    const bodies = await Promise.all(
      Array.from({ length: 10 }, () => fetch(`${base}/health`).then((r) => r.json())),
    );
    const ids = new Set((bodies as { correlationId: string }[]).map((b) => b.correlationId));
    expect(ids.size).toBe(10);
  });
});

describe('graceful shutdown', () => {
  /**
   * During drain the two endpoints deliberately disagree: /health stays 200
   * (do not kill me, I am finishing in-flight requests) while /ready returns
   * 503 (stop routing new traffic). Collapsing them loses zero-downtime
   * deploys.
   */
  it('keeps liveness up and drops readiness while draining', async () => {
    const base = await listen(loadConfig({}));
    state.draining = true;

    const health = await fetch(`${base}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toMatchObject({ status: 'shutting_down' });

    const ready = await fetch(`${base}/ready`);
    expect(ready.status).toBe(503);
    expect(await ready.json()).toMatchObject({ status: 'not_ready' });
  });

  it('skips dependency checks entirely while draining', async () => {
    let ran = false;
    registerReadinessCheck({ name: 'spy', critical: true, run: () => void (ran = true) });
    const base = await listen(loadConfig({}));
    state.draining = true;
    await fetch(`${base}/ready`);
    expect(ran).toBe(false);
  });
});

describe('handlers are pure and testable without a socket', () => {
  const correlation = { correlationId: 'corr_1', operationId: 'op_1' };

  it('handleHealth answers from process state alone', () => {
    expect(
      handleHealth({ environment: 'production', correlation, draining: false }),
    ).toEqual({ httpStatus: 200, body: { status: 'ok', correlationId: 'corr_1' } });
  });

  it('handleReady omits checks for a deployed environment', async () => {
    registerReadinessCheck({ name: 'x', critical: true, run: () => {} });
    const deployed = await handleReady({ environment: 'production', correlation, draining: false });
    const local = await handleReady({ environment: 'development', correlation, draining: false });
    expect(deployed.body.checks).toBeUndefined();
    expect(local.body.checks).toHaveLength(1);
  });
});

describe('the configuration readiness check (PAS-0002)', () => {
  it('registers itself as critical', () => {
    registerConfigCheck();
    const check = registeredChecks().find((c) => c.name === 'configuration');
    expect(check).toBeDefined();
    expect(check!.critical).toBe(true);
  });

  it('passes when configuration is resolvable', async () => {
    registerConfigCheck();
    const report = await runReadinessChecks();
    expect(report.ready).toBe(true);
    expect(report.checks.find((c) => c.name === 'configuration')?.status).toBe('pass');
  });

  it('is idempotent — registering twice yields one check, not two', () => {
    registerConfigCheck();
    registerConfigCheck();
    expect(registeredChecks().filter((c) => c.name === 'configuration')).toHaveLength(1);
  });
});
