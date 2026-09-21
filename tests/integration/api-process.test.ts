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
 * talks to it over a real socket. It is the only test in the repository that
 * exercises what actually gets deployed.
 *
 * Anything with an entry point gets one of these.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createConnection, createServer, type AddressInfo } from 'node:net';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ENTRY = join(ROOT, 'apps/api/dist/main.js');

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

let child: ChildProcessWithoutNullStreams | undefined;

afterEach(() => {
  child?.kill('SIGKILL');
  child = undefined;
});

/**
 * Asks the OS for a free port by binding one, reading the assignment, and
 * releasing it.
 *
 * A random port in a plausible range is NOT equivalent: it collides with
 * whatever a developer already has bound and with a concurrent CI job on the
 * same runner, producing a flake that looks like a product failure. There is a
 * small window between release and the child binding, but the OS will not
 * re-issue the same ephemeral port in that window under any normal load.
 */
function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });
}

async function waitForPort(port: number, timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const open = await new Promise<boolean>((res) => {
      const socket = createConnection({ port, host: '127.0.0.1' });
      socket.once('connect', () => {
        socket.destroy();
        res(true);
      });
      socket.once('error', () => {
        socket.destroy();
        res(false);
      });
    });
    if (open) return;
    if (Date.now() > deadline) throw new Error(`port ${port} did not open within ${timeoutMs}ms`);
    await new Promise((res) => setTimeout(res, 100));
  }
}

interface Started {
  base: string;
  stderr: () => string;
}

async function startProcess(env: Record<string, string> = {}): Promise<Started> {
  expect(
    existsSync(ENTRY),
    `${ENTRY} is missing. Integration tests run against the BUILT artifact — ` +
      `run \`npm run build\` first.`,
  ).toBe(true);

  const port = await freePort();
  let stderr = '';

  child = spawn(process.execPath, [ENTRY], {
    env: { ...process.env, PAS_API_PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  }) as ChildProcessWithoutNullStreams;
  child.stderr.on('data', (chunk) => (stderr += String(chunk)));

  await waitForPort(port);
  return { base: `http://127.0.0.1:${port}`, stderr: () => stderr };
}

describe('the built API process starts and serves', () => {
  it('runs `node dist/main.js` and answers /health', async () => {
    const { base } = await startProcess();
    const response = await fetch(`${base}/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok' });
  });

  it('answers /ready with the configuration check passing', async () => {
    const { base } = await startProcess();
    const body = (await (await fetch(`${base}/ready`)).json()) as {
      status: string;
      checks?: { name: string; status: string }[];
    };
    expect(body.status).toBe('ready');
    expect(body.checks?.some((c) => c.name === 'configuration' && c.status === 'pass')).toBe(true);
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
      const proc = spawn(process.execPath, [ENTRY], {
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
