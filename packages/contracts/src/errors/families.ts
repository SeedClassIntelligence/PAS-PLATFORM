/**
 * PAS-0003 — the ten required error families.
 *
 * Each carries the structured context its consumers actually need, rather than
 * a bare message. Fields here are traceable to tickets that raise them.
 */

import { PasError, type PasErrorOptions } from './base.js';
import { GENERIC_CODES } from './codes.js';

/** A single field-level problem. Shape shared with `@pas/config`. */
export interface FieldProblem {
  /** Dot-path to the offending field, or the offending input name. */
  path: string;
  message: string;
}

/**
 * The request was malformed or failed validation.
 *
 * Reports EVERY problem found, not the first — see `@pas/config`, where a
 * one-problem-per-restart startup loop was the motivating case.
 */
export class ValidationError extends PasError {
  readonly family = 'VALIDATION' as const;
  readonly problems: readonly FieldProblem[];

  constructor(
    message: string,
    problems: readonly FieldProblem[] = [],
    options: PasErrorOptions = {},
  ) {
    super(message, 'VALIDATION', {
      code: GENERIC_CODES.VALIDATION,
      details: problems.length > 0 ? { problems } : options.details,
      ...options,
    });
    this.problems = problems;
  }
}

/**
 * The caller could not be authenticated (PAS-0202).
 *
 * Details are never client-safe: distinguishing "no such user" from "wrong
 * password" is a user-enumeration oracle. The reason is for the audit log.
 */
export class AuthenticationError extends PasError {
  readonly family = 'AUTHENTICATION' as const;

  constructor(message = 'Authentication failed.', options: PasErrorOptions = {}) {
    super(message, 'AUTHENTICATION', { code: GENERIC_CODES.AUTHENTICATION, ...options });
  }
}

/**
 * The caller is authenticated but lacks the capability (PAS-0203, PAS-0204).
 *
 * Naming the capability is intentional: it tells an integrator what to request
 * without revealing whether the resource exists.
 */
export class AuthorizationError extends PasError {
  readonly family = 'AUTHORIZATION' as const;
  readonly capability?: string;

  constructor(
    message = 'You do not have permission to perform this action.',
    options: PasErrorOptions & { capability?: string } = {},
  ) {
    const { capability, ...rest } = options;
    super(message, 'AUTHORIZATION', {
      code: GENERIC_CODES.AUTHORIZATION,
      details: capability ? { requiredCapability: capability } : rest.details,
      ...rest,
    });
    this.capability = capability;
  }
}

/** The addressed resource does not exist, or is not visible to this caller. */
export class NotFoundError extends PasError {
  readonly family = 'NOT_FOUND' as const;
  readonly resourceType?: string;
  readonly resourceId?: string;

  constructor(
    message = 'Resource not found.',
    options: PasErrorOptions & { resourceType?: string; resourceId?: string } = {},
  ) {
    const { resourceType, resourceId, ...rest } = options;
    super(message, 'NOT_FOUND', {
      code: GENERIC_CODES.NOT_FOUND,
      details: resourceType ? { resourceType, resourceId } : rest.details,
      ...rest,
    });
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

/**
 * The operation conflicts with current state — a version conflict, a duplicate,
 * or an illegal lifecycle transition (PAS-0804: invalid transitions must fail
 * at domain level).
 */
export class ConflictError extends PasError {
  readonly family = 'CONFLICT' as const;
  readonly expectedVersion?: number;
  readonly actualVersion?: number;

  constructor(
    message = 'The request conflicts with the current state of the resource.',
    options: PasErrorOptions & { expectedVersion?: number; actualVersion?: number } = {},
  ) {
    const { expectedVersion, actualVersion, ...rest } = options;
    super(message, 'CONFLICT', {
      code: GENERIC_CODES.CONFLICT,
      details:
        expectedVersion !== undefined || actualVersion !== undefined
          ? { expectedVersion, actualVersion }
          : rest.details,
      ...rest,
    });
    this.expectedVersion = expectedVersion;
    this.actualVersion = actualVersion;
  }
}

/** Governance decisions a gate may return (PAS-1102). */
export type GovernanceDecision =
  | 'DENY'
  | 'REQUIRE_REVIEW'
  | 'REQUIRE_CONFIRMATION'
  | 'ESCALATE';

/**
 * A governance gate refused the operation (PAS-1101–1104, §XXXVII).
 *
 * Carries the decision, the gate, and the policy version that produced it —
 * PAS-1104 requires every governed state change to store its authorizing
 * decision, and a refusal is no less auditable than an approval.
 *
 * ── Deliberate scope boundary ────────────────────────────────────────────
 * Only DENY is unambiguously an error. REQUIRE_REVIEW and REQUIRE_CONFIRMATION
 * mean "accepted, not yet complete" — the correct HTTP answer is a success
 * carrying the resulting HumanTask reference (PAS-1201), not a 4xx. This class
 * can represent them so a caller that genuinely cannot proceed has a typed way
 * to say so, but Build 11 should return a task reference rather than throw.
 * Recorded here so the decision is not silently made later by whoever writes
 * the first gate.
 */
export class GovernanceError extends PasError {
  readonly family = 'GOVERNANCE' as const;
  readonly decision: GovernanceDecision;
  readonly gate?: string;
  readonly policyVersion?: string;

  constructor(
    message: string,
    decision: GovernanceDecision,
    options: PasErrorOptions & { gate?: string; policyVersion?: string; reason?: string } = {},
  ) {
    const { gate, policyVersion, reason, ...rest } = options;
    super(message, 'GOVERNANCE', {
      code: `governance.${decision.toLowerCase()}`,
      details: { decision, gate, policyVersion, reason },
      ...rest,
    });
    this.decision = decision;
    this.gate = gate;
    this.policyVersion = policyVersion;
  }
}

/**
 * A workflow instance or step failed (PAS-1301–1304).
 *
 * Details are not client-safe: step names, attempt counts and internal state
 * describe PAS internals, and the underlying cause routinely carries driver
 * messages containing connection strings.
 */
export class WorkflowError extends PasError {
  readonly family = 'WORKFLOW' as const;
  readonly workflow?: string;
  readonly step?: string;
  readonly instanceId?: string;

  constructor(
    message: string,
    options: PasErrorOptions & { workflow?: string; step?: string; instanceId?: string } = {},
  ) {
    const { workflow, step, instanceId, ...rest } = options;
    super(message, 'WORKFLOW', {
      code: GENERIC_CODES.WORKFLOW,
      details: { workflow, step, instanceId, ...(rest.details as object) },
      ...rest,
    });
    this.workflow = workflow;
    this.step = step;
    this.instanceId = instanceId;
  }
}

/**
 * A dependency outside PAS failed — database, object storage, an AI provider
 * through the Agent Gateway, an SMTP host.
 *
 * `retryable` lets a workflow decide whether to back off and retry (PAS-0304)
 * without parsing a message.
 */
export class ExternalServiceError extends PasError {
  readonly family = 'EXTERNAL_SERVICE' as const;
  readonly service: string;
  readonly retryable: boolean;

  constructor(
    service: string,
    message = `The ${service} service failed.`,
    options: PasErrorOptions & { retryable?: boolean } = {},
  ) {
    const { retryable = true, ...rest } = options;
    super(message, 'EXTERNAL_SERVICE', {
      code: `external_service.${service.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_failed`,
      details: { service, retryable, ...(rest.details as object) },
      ...rest,
    });
    this.service = service;
    this.retryable = retryable;
  }
}

/** The caller exceeded a rate limit (PAS-3603). */
export class RateLimitError extends PasError {
  readonly family = 'RATE_LIMIT' as const;
  readonly retryAfterSeconds?: number;
  readonly limit?: number;

  constructor(
    message = 'Rate limit exceeded.',
    options: PasErrorOptions & { retryAfterSeconds?: number; limit?: number } = {},
  ) {
    const { retryAfterSeconds, limit, ...rest } = options;
    super(message, 'RATE_LIMIT', {
      code: GENERIC_CODES.RATE_LIMIT,
      details: { retryAfterSeconds, limit },
      ...rest,
    });
    this.retryAfterSeconds = retryAfterSeconds;
    this.limit = limit;
  }
}

/**
 * An unexpected failure. The catch-all for anything not already typed.
 *
 * Neither its message nor its details reach a client in a deployed
 * environment — an unexpected error's message is the single most likely place
 * for an internal hostname, a SQL fragment or a credential to surface.
 */
export class InternalError extends PasError {
  readonly family = 'INTERNAL' as const;

  constructor(message = 'An internal error occurred.', options: PasErrorOptions = {}) {
    super(message, 'INTERNAL', { code: GENERIC_CODES.INTERNAL, ...options });
  }
}

/**
 * Converts any thrown value into a PasError.
 *
 * An unknown throw is wrapped as `InternalError` with the original retained as
 * `cause` — available to logging, never to a client. This is the boundary that
 * stops a raw driver error (whose message may contain the database URL) from
 * reaching a response.
 */
export function toPasError(value: unknown): PasError {
  if (value instanceof PasError) return value;
  if (value instanceof Error) {
    return new InternalError(value.message, { cause: value });
  }
  return new InternalError('An internal error occurred.', { cause: value });
}
