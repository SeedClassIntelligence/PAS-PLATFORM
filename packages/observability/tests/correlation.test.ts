/**
 * PAS-0004 acceptance tests.
 *
 * The load-bearing claim is "this identity follows the operation across API,
 * database, workflow, events and workers". The propagation and isolation
 * groups below are what make that true rather than aspirational.
 */

import { describe, it, expect } from 'vitest';
import { isPasError } from '@pas/contracts';
import {
  newCorrelationId,
  newOperationId,
  isValidId,
  acceptOrMintId,
  currentContext,
  currentCorrelationId,
  requireCorrelationId,
  startOperation,
  deriveChildContext,
  runWithContext,
  runInNewOperation,
  runInChildOperation,
  correlationFields,
  contextFromRecord,
  createRootContext,
  contextFromHeaders,
  correlationHeaders,
  responseCorrelationHeaders,
  CORRELATION_HEADER,
  CAUSATION_HEADER,
  TRACEPARENT_HEADER,
} from '../src/index.js';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('identifiers', () => {
  it('mints unique ids', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newCorrelationId()));
    expect(ids.size).toBe(500);
    expect(new Set(Array.from({ length: 500 }, () => newOperationId())).size).toBe(500);
  });

  it('accepts sane external id formats', () => {
    for (const id of [
      '01J8XYZABCDEFGHJKMNPQRSTVW', // ULID
      '550e8400-e29b-41d4-a716-446655440000', // UUID
      '4bf92f3577b34da6a3ce929d0e0e4736', // W3C trace id
      'req_12345',
      'a.b-c_d',
    ]) {
      expect(isValidId(id), id).toBe(true);
    }
  });
});

describe('inbound identifiers are untrusted', () => {
  it('rejects newlines — a log-injection and log-forgery vector', () => {
    expect(isValidId('abc\ndef')).toBe(false);
    expect(isValidId('abc\r\nINFO: forged log line')).toBe(false);
    expect(isValidId('abc def')).toBe(false);
  });

  it('rejects control, quoting and structural characters', () => {
    for (const bad of ['a b', 'a"b', "a'b", 'a\tb', 'a\u0000b', '{"a":1}', 'a;b', '../etc/passwd']) {
      expect(isValidId(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it('rejects an unbounded value', () => {
    expect(isValidId('a'.repeat(128))).toBe(true);
    expect(isValidId('a'.repeat(129))).toBe(false);
    expect(isValidId('')).toBe(false);
  });

  it('rejects non-strings', () => {
    for (const bad of [undefined, null, 42, {}, [], true]) {
      expect(isValidId(bad)).toBe(false);
    }
  });

  it('mints a fresh id rather than failing the request', () => {
    // A bad upstream header must not let any caller break PAS.
    const minted = acceptOrMintId('bad\nvalue');
    expect(isValidId(minted)).toBe(true);
    expect(minted).not.toContain('\n');
    expect(acceptOrMintId('req_ok')).toBe('req_ok');
  });
});

describe('every operation receives a correlationId', () => {
  it('starts a chain with a correlation id and an operation id', () => {
    const context = startOperation({ kind: 'http', name: 'POST /api/v1/claims' });
    expect(isValidId(context.correlationId)).toBe(true);
    expect(isValidId(context.operationId)).toBe(true);
    expect(context.causationId).toBeUndefined(); // root of the chain
    expect(context.kind).toBe('http');
  });

  it('continues a chain begun upstream', () => {
    const context = startOperation({ correlationId: 'corr_upstream', causationId: 'op_upstream' });
    expect(context.correlationId).toBe('corr_upstream');
    expect(context.causationId).toBe('op_upstream');
    expect(context.operationId).not.toBe('op_upstream');
  });

  it('discards a malformed inbound causation id instead of storing it', () => {
    const context = startOperation({ causationId: 'bad\nid' });
    expect(context.causationId).toBeUndefined();
  });
});

describe('causation chains', () => {
  it('links A → B → C, each step caused by the previous', () => {
    const a = startOperation({ name: 'A' });
    const b = deriveChildContext(a, { name: 'B' });
    const c = deriveChildContext(b, { name: 'C' });

    expect(b.correlationId).toBe(a.correlationId);
    expect(c.correlationId).toBe(a.correlationId);

    expect(b.causationId).toBe(a.operationId);
    expect(c.causationId).toBe(b.operationId);

    expect(new Set([a.operationId, b.operationId, c.operationId]).size).toBe(3);
  });

  it('distinguishes a fan-out from a sequence', () => {
    // A → B, A → C must not be indistinguishable from A → B → C.
    const a = startOperation();
    const b = deriveChildContext(a);
    const c = deriveChildContext(a);
    expect(b.causationId).toBe(a.operationId);
    expect(c.causationId).toBe(a.operationId);
    expect(b.operationId).not.toBe(c.operationId);
  });
});

describe('identity follows the operation', () => {
  it('survives awaits', async () => {
    await runInNewOperation({ kind: 'http' }, async (context) => {
      await sleep(1);
      expect(currentCorrelationId()).toBe(context.correlationId);
      await sleep(1);
      expect(currentContext()?.operationId).toBe(context.operationId);
    });
  });

  it('survives timers and callbacks', async () => {
    await runInNewOperation({}, async (context) => {
      const seen = await new Promise<string | undefined>((resolve) => {
        setTimeout(() => resolve(currentCorrelationId()), 1);
      });
      expect(seen).toBe(context.correlationId);
    });
  });

  it('survives Promise.all fan-out', async () => {
    await runInNewOperation({}, async (context) => {
      const seen = await Promise.all([
        (async () => {
          await sleep(2);
          return currentCorrelationId();
        })(),
        (async () => {
          await sleep(1);
          return currentCorrelationId();
        })(),
      ]);
      expect(seen).toEqual([context.correlationId, context.correlationId]);
    });
  });

  it('survives a thrown-and-caught error', async () => {
    await runInNewOperation({}, async (context) => {
      try {
        await sleep(1);
        throw new Error('boom');
      } catch {
        expect(currentCorrelationId()).toBe(context.correlationId);
      }
    });
  });
});

describe('contexts do not leak between operations', () => {
  it('keeps concurrent operations isolated', async () => {
    const results = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        runInNewOperation({ name: `op-${i}` }, async (context) => {
          await sleep(Math.random() * 5);
          const observed = currentCorrelationId();
          await sleep(Math.random() * 5);
          return { expected: context.correlationId, observed, again: currentCorrelationId() };
        }),
      ),
    );
    for (const r of results) {
      expect(r.observed).toBe(r.expected);
      expect(r.again).toBe(r.expected);
    }
    expect(new Set(results.map((r) => r.expected)).size).toBe(25);
  });

  it('leaves no context behind after an operation completes', async () => {
    expect(currentContext()).toBeUndefined();
    await runInNewOperation({}, async () => {
      expect(currentContext()).toBeDefined();
    });
    expect(currentContext()).toBeUndefined();
  });

  it('leaves no context behind when an operation throws', async () => {
    await expect(
      runInNewOperation({}, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(currentContext()).toBeUndefined();
  });

  it('restores the parent context after a nested child completes', () => {
    runInNewOperation({ name: 'parent' }, (parent) => {
      runInChildOperation({ name: 'child' }, (child) => {
        expect(child.causationId).toBe(parent.operationId);
        expect(currentContext()?.operationId).toBe(child.operationId);
      });
      expect(currentContext()?.operationId).toBe(parent.operationId);
    });
  });
});

describe('requireCorrelationId', () => {
  it('returns the id inside an operation', () => {
    runInNewOperation({}, (context) => {
      expect(requireCorrelationId()).toBe(context.correlationId);
    });
  });

  it('throws a PAS error outside one, rather than writing an unattributable record', () => {
    expect(() => requireCorrelationId()).toThrow();
    try {
      requireCorrelationId();
    } catch (error) {
      expect(isPasError(error)).toBe(true);
      expect((error as { code: string }).code).toBe('correlation.missing_context');
    }
  });
});

describe('stamping events, outbox rows and audit entries', () => {
  it('sets causationId to the CURRENT operation id, not the current causationId', () => {
    // The event is caused by the operation emitting it — not by that
    // operation's own parent. Getting this backwards yields a causal graph
    // that looks plausible and is wrong.
    const parent = startOperation({ name: 'parent' });
    runWithContext(deriveChildContext(parent, { name: 'child' }), () => {
      const child = currentContext()!;
      const fields = correlationFields();
      expect(fields.correlationId).toBe(parent.correlationId);
      expect(fields.causationId).toBe(child.operationId);
      expect(fields.causationId).not.toBe(child.causationId);
    });
  });

  it('returns empty fields outside an operation rather than inventing identity', () => {
    expect(correlationFields()).toEqual({});
  });
});

describe('workers restore context from a persisted record (PAS-0305)', () => {
  it('reconnects the chain across a process boundary', () => {
    // An API request emits an outbox row...
    const apiContext = startOperation({ kind: 'http' });
    const row = runWithContext(apiContext, () => correlationFields());

    // ...a worker later claims it in a different process.
    const workerContext = contextFromRecord(row, { kind: 'worker', name: 'dispatch' });

    expect(workerContext.correlationId).toBe(apiContext.correlationId);
    expect(workerContext.causationId).toBe(apiContext.operationId);
    expect(workerContext.operationId).not.toBe(apiContext.operationId);
  });

  it('mints a fresh chain for a record with no correlation, rather than failing', () => {
    const context = contextFromRecord({}, { kind: 'worker' });
    expect(isValidId(context.correlationId)).toBe(true);
    expect(context.causationId).toBeUndefined();
  });

  it('discards a corrupted stored value', () => {
    const context = contextFromRecord({ correlationId: 'bad\nvalue', causationId: 'also bad' });
    expect(context.correlationId).not.toContain('\n');
    expect(isValidId(context.correlationId)).toBe(true);
    expect(context.causationId).toBeUndefined();
  });
});

describe('HTTP propagation', () => {
  it('reads PAS headers from a plain header object', () => {
    const context = contextFromHeaders({
      [CORRELATION_HEADER]: 'corr_inbound',
      [CAUSATION_HEADER]: 'op_caller',
    });
    expect(context.correlationId).toBe('corr_inbound');
    expect(context.causationId).toBe('op_caller');
    expect(context.kind).toBe('http');
  });

  it('reads from a Headers-like object', () => {
    const headers = new Map([[CORRELATION_HEADER, 'corr_fetch']]);
    const context = contextFromHeaders({ get: (n: string) => headers.get(n) ?? null });
    expect(context.correlationId).toBe('corr_fetch');
  });

  it('falls back to the W3C traceparent trace-id', () => {
    const context = contextFromHeaders({
      [TRACEPARENT_HEADER]: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    });
    expect(context.correlationId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
  });

  it('ignores a malformed traceparent', () => {
    const context = contextFromHeaders({ [TRACEPARENT_HEADER]: 'garbage' });
    expect(isValidId(context.correlationId)).toBe(true);
    expect(context.correlationId).not.toBe('garbage');
  });

  it('prefers the explicit PAS header over traceparent', () => {
    const context = contextFromHeaders({
      [CORRELATION_HEADER]: 'corr_explicit',
      [TRACEPARENT_HEADER]: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
    });
    expect(context.correlationId).toBe('corr_explicit');
  });

  it('neutralises a hostile inbound header', () => {
    const context = contextFromHeaders({
      [CORRELATION_HEADER]: 'x\n2026-01-01 INFO Payment approved',
    });
    expect(context.correlationId).not.toContain('\n');
    expect(context.correlationId).not.toContain('Payment approved');
  });

  it('propagates the current operation as the callee’s cause', () => {
    runInNewOperation({}, (context) => {
      const headers = correlationHeaders();
      expect(headers[CORRELATION_HEADER]).toBe(context.correlationId);
      expect(headers[CAUSATION_HEADER]).toBe(context.operationId);
    });
  });

  it('emits no headers outside an operation', () => {
    expect(correlationHeaders()).toEqual({});
  });

  it('echoes the correlation id on responses so callers can quote it', () => {
    const context = createRootContext('http');
    expect(responseCorrelationHeaders(context)).toEqual({
      [CORRELATION_HEADER]: context.correlationId,
    });
  });
});

describe('end-to-end: an operation chain across boundaries', () => {
  it('traces API → event → worker → child step with one correlation id', async () => {
    const inbound = { [CORRELATION_HEADER]: 'corr_e2e' };

    // 1. API request
    const apiContext = contextFromHeaders(inbound, { name: 'POST /api/v1/sources' });
    const outboxRow = runWithContext(apiContext, () => correlationFields());

    // 2. Worker claims the row in another process
    const workerContext = contextFromRecord(outboxRow, { kind: 'worker' });

    // 3. Worker runs a child step
    const child = await runWithContext(workerContext, async () => {
      await sleep(1);
      return runInChildOperation({ kind: 'workflow', name: 'PARSE' }, (ctx) => ({
        context: ctx,
        stamped: correlationFields(),
      }));
    });

    // One correlation id across every hop — this is what you search by.
    expect(apiContext.correlationId).toBe('corr_e2e');
    expect(workerContext.correlationId).toBe('corr_e2e');
    expect(child.context.correlationId).toBe('corr_e2e');
    expect(child.stamped.correlationId).toBe('corr_e2e');

    // Causation reconnects across each hop, forming API → worker → step.
    expect(workerContext.causationId).toBe(apiContext.operationId);
    expect(child.context.causationId).toBe(workerContext.operationId);

    // Anything the child emits names the child as its cause.
    expect(child.stamped.causationId).toBe(child.context.operationId);

    // Four distinct steps, one chain.
    expect(
      new Set([apiContext.operationId, workerContext.operationId, child.context.operationId]).size,
    ).toBe(3);
  });
});
