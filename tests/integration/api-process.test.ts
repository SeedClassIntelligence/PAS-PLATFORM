/**
 * PAS-0006 — integration: the API process.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 *
 * PAS-0005 shipped 27 passing unit tests against an API that could not start:
 *
 *     ERR_MODULE_NOT_FOUND: Cannot find module .../apps/api/src/server.js
 *
 * Every unit test passed because vitest transforms TypeScript source. `node`
 * does not. No amount of unit testing could have caught it, because unit tests
 * never touch the artifact that ships.
 *
 * This suite spawns the BUILT process — `node apps/api/dist/main.js` — and
 * talks to it over a real socket. It is the only kind of test in the repository
 * that exercises what actually gets deployed.
 *
 * Anything with an entry point gets one of these.
 *
 * PAS-0102 registered the database readiness checks, so `/ready` now requires a
 * reachable, migrated database. The suites below that assert readiness supply
 * one; the rest assert liveness, the wire contract, or startup refusal, none of
 * which depend on a database.
 */

import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { spawn } from 'node:child_process';
import {
  API_ENTRY,
  MIGRATE_ENTRY,
  ROOT,
  freePort,
  killAllChildren,
  runNode,
  startApiProcess,
  readiness,
} from './harness.js';

/** Real-looking deployed configuration. None of this may appear on the wire. */
const PRODUCTION_ENV = {
  PAS_ENV: 'production',
  PAS_DATABASE_URL: 'postgresql://pas:hunter2@db.internal:5432/pas_production',
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
};

/** A database whose schema is current, so readiness can be asserted. */
/** Pinned to `pas_test` by `vitest.config.ts`, never an ambient value. */
const DEV_DATABASE_URL = process.env.PAS_DATABASE_URL as string;

beforeAll(async () => {
  // The repository's own migrations, applied to the development database.
  // `/ready` asserts the schema matches this build; bringing it up to date here
  // keeps that assertion about the API rather than about the fixture.
  const result = await runNode(MIGRATE_ENTRY, ['up'], { PAS_DATABASE_URL: DEV_DATABASE_URL });
  expect(result.code, result.stderr).toBe(0);
}, 30_000);

afterEach(() => {
  killAllChildren();
});

const startProcess = startApiProcess;

describe('the built API process starts and serves', () => {
  it('runs `node dist/main.js` and answers /health', async () => {
    const { base } = await startProcess();
    const response = await fetch(`${base}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok' });
  });

  it('answers /ready with every registered check passing', async () => {
    const { base } = await startProcess({ PAS_DATABASE_URL: DEV_DATABASE_URL });
    const { status, body } = await readiness(base);

    expect(status, JSON.stringify(body)).toBe(200);
    expect(body.status).toBe('ready');
    // PAS-0005 configuration, plus the two PAS-0102 added.
    expect(body.checks?.filter((c) => c.status === 'pass').map((c) => c.name).sort()).toEqual([
      'configuration',
      'database',
      'database.schema',
    ]);
  });

  it('carries a correlation id on the wire', async () => {
    const { base } = await startProcess();
    const response = await fetch(`${base}/health`);
    const header = response.headers.get('x-correlation-id');
    const body = (await response.json()) as { correlationId: string };
    expect(header).toBeTruthy();
    expect(header).toBe(body.correlationId);
  });

  it('serves a typed 404 from the shared error contract', async () => {
    const { base } = await startProcess();
    const response = await fetch(`${base}/not-a-route`);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: 'resource.not_found', family: 'NOT_FOUND' },
    });
  });
});

describe('the deployed process leaks nothing on the wire', () => {
  it('returns status and correlation id only, in production', async () => {
    const { base } = await startProcess(PRODUCTION_ENV);
    const raw = await (await fetch(`${base}/ready`)).text();

    for (const secret of [
      'hunter2',
      'db.internal',
      'storage.internal',
      'postgresql',
      '5432',
      'configuration', // the check NAME maps PAS's dependencies
      'checks',
      'mail.internal',
      'A'.repeat(32),
      'C'.repeat(48),
    ]) {
      expect(raw, `leaked on the wire: ${secret}`).not.toContain(secret);
    }

    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(['correlationId', 'status']);
  });

  it('returns no stack trace from the deployed process', async () => {
    const { base } = await startProcess(PRODUCTION_ENV);
    for (const path of ['/health', '/ready', '/nope']) {
      const raw = await (await fetch(`${base}${path}`)).text();
      expect(raw, path).not.toContain('    at ');
      expect(raw, path).not.toContain('.js:');
    }
  });
});

describe('the process refuses to start on invalid deployed configuration', () => {
  /**
   * PAS-0002: "Applications must fail startup when required production
   * configuration is invalid." A server that binds a port before knowing it is
   * configured is a server that serves errors instead of refusing to exist.
   */
  it('exits non-zero rather than binding the port', async () => {
    const port = await freePort();
    let stderr = '';

    const exitCode = await new Promise<number>((res) => {
      const proc = spawn(process.execPath, [API_ENTRY], {
        cwd: ROOT,
        env: { ...process.env, PAS_ENV: 'production', PAS_API_PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      proc.stderr.on('data', (c) => (stderr += String(c)));
      proc.on('exit', (code) => res(code ?? -1));
    });

    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('configuration is invalid');
    // Reports every problem at once, not one per restart.
    expect(stderr).toMatch(/\d+ problems/);
  });
});
