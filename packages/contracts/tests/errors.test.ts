/**
 * PAS-0003 acceptance tests.
 *
 * The load-bearing requirement is the last line of the ticket:
 * "Never expose stack traces or secrets through production APIs."
 * The leak-prevention groups below are adversarial by design.
 */

import { describe, it, expect } from 'vitest';
import {
  ERROR_FAMILIES,
  FAMILY_DETAILS_ARE_CLIENT_SAFE,
  FAMILY_HTTP_STATUS,
  REDACTED_MESSAGE,
  REDACTED,
  PasError,
  isPasError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  GovernanceError,
  WorkflowError,
  ExternalServiceError,
  RateLimitError,
  InternalError,
  toPasError,
  toErrorResponse,
  toErrorLogRecord,
  scrubDetails,
  type ErrorFamily,
} from '../src/index.js';

const CID = 'corr-01J8XYZ';

/** One instance of every family, for exhaustive sweeps. */
const oneOfEach: ReadonlyArray<[ErrorFamily, PasError]> = [
  ['VALIDATION', new ValidationError('bad input', [{ path: 'name', message: 'required' }])],
  ['AUTHENTICATION', new AuthenticationError()],
  ['AUTHORIZATION', new AuthorizationError('nope', { capability: 'claim.approve' })],
  ['NOT_FOUND', new NotFoundError('gone', { resourceType: 'Claim', resourceId: 'c-1' })],
  ['CONFLICT', new ConflictError('stale', { expectedVersion: 2, actualVersion: 3 })],
  ['GOVERNANCE', new GovernanceError('denied by G3', 'DENY', { gate: 'G3' })],
  ['WORKFLOW', new WorkflowError('step blew up', { workflow: 'SOURCE_INGESTION', step: 'PARSE' })],
  ['EXTERNAL_SERVICE', new ExternalServiceError('postgres', 'connection refused')],
  ['RATE_LIMIT', new RateLimitError('slow down', { retryAfterSeconds: 30 })],
  ['INTERNAL', new InternalError('null deref in ClaimService')],
];

describe('the ten required families', () => {
  it('declares exactly the families PAS-0003 requires', () => {
    expect([...ERROR_FAMILIES]).toEqual([
      'VALIDATION',
      'AUTHENTICATION',
      'AUTHORIZATION',
      'NOT_FOUND',
      'CONFLICT',
      'GOVERNANCE',
      'WORKFLOW',
      'EXTERNAL_SERVICE',
      'RATE_LIMIT',
      'INTERNAL',
    ]);
  });

  it('provides a class for every family, and no family lacks one', () => {
    expect(oneOfEach.map(([family]) => family).sort()).toEqual([...ERROR_FAMILIES].sort());
    for (const [family, error] of oneOfEach) {
      expect(error.family, family).toBe(family);
    }
  });

  it('every family is a PasError and a real Error', () => {
    for (const [family, error] of oneOfEach) {
      expect(isPasError(error), family).toBe(true);
      expect(error instanceof Error, family).toBe(true);
      expect(error.stack, family).toBeDefined();
    }
  });

  it('preserves instanceof for each concrete class', () => {
    expect(new ValidationError('x') instanceof ValidationError).toBe(true);
    expect(new NotFoundError() instanceof NotFoundError).toBe(true);
    expect(new NotFoundError() instanceof ValidationError).toBe(false);
    expect(new InternalError() instanceof PasError).toBe(true);
  });

  it('maps each family to a sensible HTTP status', () => {
    for (const [family, error] of oneOfEach) {
      expect(error.httpStatus, family).toBe(FAMILY_HTTP_STATUS[family]);
    }
    expect(FAMILY_HTTP_STATUS.VALIDATION).toBe(400);
    expect(FAMILY_HTTP_STATUS.AUTHENTICATION).toBe(401);
    expect(FAMILY_HTTP_STATUS.AUTHORIZATION).toBe(403);
    expect(FAMILY_HTTP_STATUS.NOT_FOUND).toBe(404);
    expect(FAMILY_HTTP_STATUS.CONFLICT).toBe(409);
    expect(FAMILY_HTTP_STATUS.RATE_LIMIT).toBe(429);
    expect(FAMILY_HTTP_STATUS.INTERNAL).toBe(500);
    expect(FAMILY_HTTP_STATUS.EXTERNAL_SERVICE).toBe(502);
  });
});

describe('the wire contract', () => {
  it('always carries code, message, family and correlationId', () => {
    for (const [family, error] of oneOfEach) {
      const { error: body } = toErrorResponse(error, { correlationId: CID, deployed: true });
      expect(body.code, family).toBeTruthy();
      expect(body.message, family).toBeTruthy();
      expect(body.family, family).toBe(family);
      expect(body.correlationId, family).toBe(CID);
    }
  });

  it('stamps the boundary correlation id even when the error has none', () => {
    const error = new NotFoundError();
    expect(error.correlationId).toBeUndefined();
    const { error: body } = toErrorResponse(error, { correlationId: CID });
    expect(body.correlationId).toBe(CID);
  });

  it('lets a throw site attach correlation identity when it knows it', () => {
    const error = new ConflictError('x').withCorrelationId('corr-known');
    expect(error.correlationId).toBe('corr-known');
  });
});

describe('details when safe', () => {
  it('returns details for families describing the caller’s own request', () => {
    for (const family of ['VALIDATION', 'AUTHORIZATION', 'NOT_FOUND', 'CONFLICT', 'GOVERNANCE', 'RATE_LIMIT'] as const) {
      expect(FAMILY_DETAILS_ARE_CLIENT_SAFE[family], family).toBe(true);
    }
    const error = oneOfEach.find(([f]) => f === 'VALIDATION')![1];
    const { error: body } = toErrorResponse(error, { correlationId: CID, deployed: true });
    expect(body.details).toEqual({ problems: [{ path: 'name', message: 'required' }] });
  });

  it('withholds details for families describing PAS internals', () => {
    for (const family of ['AUTHENTICATION', 'WORKFLOW', 'EXTERNAL_SERVICE', 'INTERNAL'] as const) {
      expect(FAMILY_DETAILS_ARE_CLIENT_SAFE[family], family).toBe(false);
      const error = oneOfEach.find(([f]) => f === family)![1];
      const { error: body } = toErrorResponse(error, { correlationId: CID, deployed: true });
      expect(body.details, family).toBeUndefined();
    }
  });

  it('reveals withheld details outside deployed environments', () => {
    const error = new WorkflowError('boom', { workflow: 'SOURCE_INGESTION', step: 'PARSE' });
    const { error: body } = toErrorResponse(error, { correlationId: CID, deployed: false });
    expect(body.details).toMatchObject({ workflow: 'SOURCE_INGESTION', step: 'PARSE' });
    expect(body.message).toBe('boom');
  });

  it('honours an explicit narrowing of a normally-safe family', () => {
    const error = new ValidationError('x', [], { detailsAreClientSafe: false, details: { a: 1 } });
    const { error: body } = toErrorResponse(error, { correlationId: CID, deployed: true });
    expect(body.details).toBeUndefined();
  });
});

describe('never expose stack traces or secrets', () => {
  it('never includes a stack, in any environment', () => {
    for (const deployed of [true, false]) {
      for (const [family, error] of oneOfEach) {
        const serialised = JSON.stringify(toErrorResponse(error, { correlationId: CID, deployed }));
        expect(serialised, `${family} deployed=${deployed}`).not.toContain('stack');
        expect(serialised, `${family} deployed=${deployed}`).not.toContain('.ts:');
        expect(serialised, `${family} deployed=${deployed}`).not.toContain('    at ');
      }
    }
  });

  it('redacts an internal message in a deployed environment', () => {
    const error = new InternalError('connect ECONNREFUSED postgres://pas:hunter2@db.internal:5432');
    const { error: body } = toErrorResponse(error, { correlationId: CID, deployed: true });
    expect(body.message).toBe(REDACTED_MESSAGE);
    expect(JSON.stringify(body)).not.toContain('hunter2');
    expect(JSON.stringify(body)).not.toContain('db.internal');
  });

  it('never leaks the cause of an unknown throw', () => {
    const raw = new Error('FATAL: password authentication failed for user "pas" at db.internal');
    const { error: body } = toErrorResponse(raw, { correlationId: CID, deployed: true });
    expect(body.family).toBe('INTERNAL');
    expect(body.message).toBe(REDACTED_MESSAGE);
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain('db.internal');
    expect(serialised).not.toContain('password authentication');
  });

  it('wraps a non-Error throw without leaking it', () => {
    const { error: body } = toErrorResponse(
      { token: 'sk-live-AAAAAAAAAAAAAAAAAAAAAA' },
      { correlationId: CID, deployed: true },
    );
    expect(body.family).toBe('INTERNAL');
    expect(JSON.stringify(body)).not.toContain('sk-live');
  });

  it('defaults to deployed behaviour when the flag is omitted', () => {
    const { error: body } = toErrorResponse(new InternalError('internal detail'), {
      correlationId: CID,
    });
    expect(body.message).toBe(REDACTED_MESSAGE);
  });

  it('scrubs credentials that reach a client-safe family’s details', () => {
    const error = new ValidationError('bad request', [], {
      details: {
        submitted: {
          email: 'user@example.com',
          password: 'hunter2',
          apiKey: 'sk-live-AAAAAAAAAAAAAAAAAAAAAA',
          Authorization: 'Bearer abcdefghijklmnopqrstuvwxyz0123',
        },
        connection: 'postgresql://pas:hunter2@db.internal:5432/pas',
      },
    });
    const serialised = JSON.stringify(toErrorResponse(error, { correlationId: CID, deployed: true }));
    for (const secret of ['hunter2', 'sk-live-', 'abcdefghijklmnop', 'db.internal:5432']) {
      expect(serialised, `leaked: ${secret}`).not.toContain(secret);
    }
    expect(serialised).toContain('user@example.com'); // not a secret; kept for debuggability
  });
});

describe('scrubDetails', () => {
  it('redacts by key name, case-insensitively', () => {
    const out = scrubDetails({
      password: 'x',
      API_KEY: 'y',
      sessionToken: 'z',
      clientSecret: 'w',
      harmless: 'kept',
    }) as Record<string, unknown>;
    expect(out.password).toBe(REDACTED);
    expect(out.API_KEY).toBe(REDACTED);
    expect(out.sessionToken).toBe(REDACTED);
    expect(out.clientSecret).toBe(REDACTED);
    expect(out.harmless).toBe('kept');
  });

  it('redacts credential-shaped values under innocent key names', () => {
    const out = scrubDetails({
      note: 'postgresql://user:pw@host:5432/db',
      blob: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdefg',
      aws: 'AKIAIOSFODNN7EXAMPLE',
      pem: '-----BEGIN RSA PRIVATE KEY-----\nMIIE',
    }) as Record<string, unknown>;
    expect(out.note).toBe(REDACTED);
    expect(out.blob).toBe(REDACTED);
    expect(out.aws).toBe(REDACTED);
    expect(out.pem).toBe(REDACTED);
  });

  it('strips the stack from an Error nested in details', () => {
    const out = scrubDetails({ failure: new Error('inner failure') }) as Record<string, unknown>;
    expect(out.failure).toEqual({ name: 'Error', message: 'inner failure' });
    expect(JSON.stringify(out)).not.toContain('    at ');
  });

  it('bounds depth, breadth and string length', () => {
    let deep: Record<string, unknown> = { end: 'bottom' };
    for (let i = 0; i < 12; i += 1) deep = { nest: deep };
    expect(JSON.stringify(scrubDetails(deep))).toContain('[DEPTH LIMIT]');

    const wide = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`k${i}`, i]));
    expect(JSON.stringify(scrubDetails(wide))).toContain('MORE KEYS');

    const long = { text: 'a'.repeat(5_000) };
    expect(JSON.stringify(scrubDetails(long))).toContain('TRUNCATED');
  });

  it('survives circular references', () => {
    const circular: Record<string, unknown> = { name: 'root' };
    circular.self = circular;
    expect(() => JSON.stringify(scrubDetails(circular))).not.toThrow();
    expect(JSON.stringify(scrubDetails(circular))).toContain('[CIRCULAR]');
  });

  it('does not mutate its input', () => {
    const input = { password: 'hunter2', nested: { token: 'abc' } };
    scrubDetails(input);
    expect(input.password).toBe('hunter2');
    expect(input.nested.token).toBe('abc');
  });
});

describe('log records (PAS-0301)', () => {
  it('keeps the real message and cause for operators, but scrubs details', () => {
    const cause = new Error('FATAL: connection refused');
    const error = new WorkflowError('ingestion failed', {
      workflow: 'SOURCE_INGESTION',
      step: 'PARSE',
      cause,
      details: { apiKey: 'sk-live-SECRETSECRETSECRET' },
    });
    const record = toErrorLogRecord(error, { correlationId: CID, causationId: 'caus-1' });

    expect(record.message).toBe('ingestion failed');
    expect(record.correlationId).toBe(CID);
    expect(record.causationId).toBe('caus-1');
    expect(record.stack).toBeDefined();
    expect(JSON.stringify(record.details)).not.toContain('sk-live-SECRET');
  });
});

describe('family-specific structure', () => {
  it('ValidationError reports every problem, not just the first', () => {
    const error = new ValidationError('3 problems', [
      { path: 'a', message: 'required' },
      { path: 'b', message: 'too short' },
      { path: 'c', message: 'not a url' },
    ]);
    expect(error.problems).toHaveLength(3);
  });

  it('AuthorizationError names the capability without revealing existence', () => {
    const error = new AuthorizationError('denied', { capability: 'claim.approve' });
    const { error: body } = toErrorResponse(error, { correlationId: CID, deployed: true });
    expect(body.details).toEqual({ requiredCapability: 'claim.approve' });
  });

  it('GovernanceError carries decision, gate and policy version', () => {
    const error = new GovernanceError('publication denied', 'DENY', {
      gate: 'G3',
      policyVersion: 'pol-v4',
      reason: 'missing evidence',
    });
    expect(error.decision).toBe('DENY');
    expect(error.code).toBe('governance.deny');
    const { error: body } = toErrorResponse(error, { correlationId: CID, deployed: true });
    expect(body.details).toMatchObject({ decision: 'DENY', gate: 'G3', policyVersion: 'pol-v4' });
  });

  it('ExternalServiceError exposes retryability to workflows (PAS-0304)', () => {
    expect(new ExternalServiceError('postgres').retryable).toBe(true);
    expect(new ExternalServiceError('agent-gateway', 'bad request', { retryable: false }).retryable).toBe(
      false,
    );
    expect(new ExternalServiceError('object storage').code).toBe(
      'external_service.object_storage_failed',
    );
  });

  it('RateLimitError carries retry-after for the 429 header', () => {
    const error = new RateLimitError('slow down', { retryAfterSeconds: 30, limit: 300 });
    expect(error.retryAfterSeconds).toBe(30);
    expect(error.httpStatus).toBe(429);
  });

  it('toPasError passes a PasError through unchanged', () => {
    const original = new NotFoundError('gone');
    expect(toPasError(original)).toBe(original);
  });
});
