/** PAS-0003 — Shared Error Contract. */

export {
  ERROR_FAMILIES,
  type ErrorFamily,
  FAMILY_DETAILS_ARE_CLIENT_SAFE,
  FAMILY_HTTP_STATUS,
  GENERIC_CODES,
  REDACTED_MESSAGE,
} from './codes.js';

export { PasError, isPasError, type PasErrorOptions } from './base.js';

export {
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
  type FieldProblem,
  type GovernanceDecision,
} from './families.js';

export { scrubDetails, REDACTED, type ScrubOptions } from './scrub.js';

export {
  toErrorResponse,
  toErrorLogRecord,
  type ErrorResponse,
  type SerializeOptions,
} from './response.js';
