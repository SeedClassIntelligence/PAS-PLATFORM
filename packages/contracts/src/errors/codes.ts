/**
 * PAS-0003 — Shared Error Contract
 *
 * Stable, machine-readable error identity.
 *
 * `family` is the ten-way classification PAS-0003 requires. `code` is the
 * specific, stable string a client may branch on — it is part of the API
 * contract and must not be renamed once published.
 */

/** The ten error families required by PAS-0003. */
export const ERROR_FAMILIES = [
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
] as const;

export type ErrorFamily = (typeof ERROR_FAMILIES)[number];

/**
 * Whether a family's `details` may be returned to a client in a deployed
 * environment.
 *
 * The distinction is not severity, it is *provenance of the information*:
 *
 *   safe    — details describe the CALLER'S OWN request. A validation
 *             failure, a missing id, a version conflict, a governance
 *             decision. The caller supplied it; returning it leaks nothing.
 *
 *   unsafe  — details describe PAS INTERNALS. A failing workflow step, an
 *             upstream service's response body, an unexpected exception.
 *             These routinely carry connection strings, internal hostnames,
 *             table names and third-party payloads.
 *
 * AUTHENTICATION is unsafe for a different reason: distinguishing "no such
 * user" from "wrong password" is a user-enumeration oracle.
 */
export const FAMILY_DETAILS_ARE_CLIENT_SAFE: Readonly<Record<ErrorFamily, boolean>> =
  Object.freeze({
    VALIDATION: true,
    AUTHENTICATION: false,
    AUTHORIZATION: true,
    NOT_FOUND: true,
    CONFLICT: true,
    GOVERNANCE: true,
    WORKFLOW: false,
    EXTERNAL_SERVICE: false,
    RATE_LIMIT: true,
    INTERNAL: false,
  });

/** Default HTTP status per family. Individual errors may override. */
export const FAMILY_HTTP_STATUS: Readonly<Record<ErrorFamily, number>> = Object.freeze({
  VALIDATION: 400,
  AUTHENTICATION: 401,
  AUTHORIZATION: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  GOVERNANCE: 403,
  WORKFLOW: 500,
  EXTERNAL_SERVICE: 502,
  RATE_LIMIT: 429,
  INTERNAL: 500,
});

/**
 * Generic fallback codes. Specific codes are declared by the subsystem that
 * raises them (e.g. `claim.invalid_transition`, `publication.gate_denied`) and
 * are conventionally `<subsystem>.<snake_case_reason>`.
 */
export const GENERIC_CODES = {
  VALIDATION: 'validation.failed',
  AUTHENTICATION: 'authentication.failed',
  AUTHORIZATION: 'authorization.denied',
  NOT_FOUND: 'resource.not_found',
  CONFLICT: 'resource.conflict',
  GOVERNANCE: 'governance.denied',
  WORKFLOW: 'workflow.failed',
  EXTERNAL_SERVICE: 'external_service.failed',
  RATE_LIMIT: 'rate_limit.exceeded',
  INTERNAL: 'internal.error',
} as const satisfies Record<ErrorFamily, string>;

/**
 * The message returned to clients in place of an unsafe one. Constant by
 * design: a varying fallback is itself an information channel.
 */
export const REDACTED_MESSAGE = 'An internal error occurred.' as const;
