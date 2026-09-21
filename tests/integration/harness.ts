/**
 * Shared harness for integration tests.
 *
 * Integration tests spawn the BUILT artifact — `node <pkg>/dist/...` — and talk
 * to it over a real socket. Unit tests resolve `@pas/*` to TypeScript source
 * through vitest's transform; `node` does not. PAS-0005 shipped 27 green unit
 * tests against an API that could not start, which is why this exists.
 *
 * Extracted at PAS-0102 rather than copied into the second suite: two copies of
 * a port allocator drift, and the one that drifts is the one that flakes.
 */

import { expect } from 'vitest';
import { spawn, type ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createConnection, createServer, type AddressInfo } from 'node:net';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const API_ENTRY = join(ROOT, 'apps/api/dist/main.js');
export const MIGRATE_ENTRY = join(ROOT, 'packages/database/dist/migrate/cli.js');

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
export function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close((error) => (error ? reject(error) : resolvePort(port)));
    });
  });
}

export async function waitForPort(port: number, timeoutMs = 15_000): Promise<void> {
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

/** `stdio: ['ignore', 'pipe', 'pipe']` — stdin is null, stdout and stderr are readable. */
type PipedChild = ChildProcessByStdio<null, Readable, Readable>;

export interface Started {
  base: string;
  stderr: () => string;
  child: PipedChild;
}

/** Tracks every spawned child so a failing assertion cannot leak a process. */
const live = new Set<PipedChild>();

export function killAllChildren(): void {
  for (const c of live) c.kill('SIGKILL');
  live.clear();
}

export async function startApiProcess(env: Record<string, string> = {}): Promise<Started> {
  expect(
    existsSync(API_ENTRY),
    `${API_ENTRY} is missing. Integration tests run against the BUILT artifact — ` +
      `run \`npm run build\` first.`,
  ).toBe(true);

  const port = await freePort();
  let stderr = '';

  const child: PipedChild = spawn(process.execPath, [API_ENTRY], {
    cwd: ROOT,
    env: { ...process.env, PAS_API_PORT: String(port), ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  live.add(child);
  child.stderr.on('data', (chunk) => (stderr += String(chunk)));

  await waitForPort(port);
  return { base: `http://127.0.0.1:${port}`, stderr: () => stderr, child };
}

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs a built Node entry point to completion. */
export function runNode(
  entry: string,
  args: string[],
  env: Record<string, string> = {},
): Promise<CommandResult> {
  return new Promise((res, reject) => {
    expect(existsSync(entry), `${entry} is missing — run \`npm run build\` first.`).toBe(true);
    const proc = spawn(process.execPath, [entry, ...args], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (c) => (stdout += String(c)));
    proc.stderr.on('data', (c) => (stderr += String(c)));
    proc.once('error', reject);
    proc.once('exit', (code) => res({ code: code ?? -1, stdout, stderr }));
  });
}

export interface ReadyBody {
  status: string;
  correlationId: string;
  checks?: { name: string; status: string; detail?: string }[];
}

export async function readiness(base: string): Promise<{ status: number; body: ReadyBody }> {
  const response = await fetch(`${base}/ready`);
  return { status: response.status, body: (await response.json()) as ReadyBody };
}
