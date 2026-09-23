/** PAS-0004 — Correlation Context. */

export {
  MAX_ID_LENGTH,
  newCorrelationId,
  newOperationId,
  isValidId,
  acceptOrMintId,
} from './ids.js';

export {
  type CorrelationContext,
  type StartOperationOptions,
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
} from './context.js';

export {
  CORRELATION_HEADER,
  CAUSATION_HEADER,
  TRACEPARENT_HEADER,
  contextFromHeaders,
  correlationHeaders,
  responseCorrelationHeaders,
} from './propagate.js';
