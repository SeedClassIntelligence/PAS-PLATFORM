/**
 * PAS-0003 — Shared Error Contract
 *
 * The base every PAS error extends.
 *
 * Design note — correlationId is optional here and required in the response.
 * PAS-0004 assigns correlation identity at the operation boundary. A throw
 * site deep in a domain service should not have to thread a correlation id
 * through its signature to raise an error, and requiring it there would make
 * the contract expensive enough that callers route around it. The boundary
 * that serialises the error supplies it (see `toErrorResponse`). An error may
 * still carry one when it is known at the throw site.
 */

import {
  type ErrorFamily,
  FAMILY_DETAILS_ARE_CLIENT_SAFE,
  FAMILY_HTTP_STATUS,
} from './codes.js';

export interface PasErrorOptions {
  /** Stable machine-readable code, conventionally `<subsystem>.<reason>`. */
  code?: string;
  /** Structured context. Emitted only when the family permits and after scrubbing. */
  details?: unknown;
  /** Correlation id, when known at the throw site. Usually supplied at the boundary. */
  correlationId?: string;
  /** Underlying cause. Retained for logging; never serialised to a client. */
  cause?: unknown;
  /** Override the family's default HTTP status. */
  httpStatus?: number;
  /**
   * Override whether details are client-safe. Narrowing (true → false) is
   * always honoured. Widening is honoured but should be rare and deliberate —
   * the family defaults exist because they are usually right.
   */
  detailsAreClientSafe?: boolean;
}

export abstract class PasError extends Error {
  abstract readonly family: ErrorFamily;

  readonly code: string;
  readonly details?: unknown;
  readonly httpStatus: number;
  readonly detailsAreClientSafe: boolean;
  /** Mutable so a boundary can stamp correlation identity onto an in-flight error. */
  correlationId?: string;

  protected constructor(message: string, family: ErrorFamily, options: PasErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.code = options.code ?? `${family.toLowerCase()}.error`;
    this.details = options.details;
    this.correlationId = options.correlationId;
    this.httpStatus = options.httpStatus ?? FAMILY_HTTP_STATUS[family];
    this.detailsAreClientSafe =
      options.detailsAreClientSafe ?? FAMILY_DETAILS_ARE_CLIENT_SAFE[family];

    // Restore the prototype chain so `instanceof` survives transpilation.
    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) Error.captureStackTrace(this, new.target);
  }

  /** Returns this error with correlation identity attached. */
  withCorrelationId(correlationId: string): this {
    this.correlationId = correlationId;
    return this;
  }
}

export function isPasError(value: unknown): value is PasError {
  return value instanceof PasError;
}
