/** PAS-0204 — Authorization Service. */

export {
  type Actor,
  type ResourceContext,
  type AuthorizationDecision,
  type AllowReason,
  type DenyReason,
  ANONYMOUS,
  PLATFORM_SCOPE,
  actorForUser,
  inAccount,
  isAllowed,
} from './types.js';

export { authorize } from './authorize.js';
export { type Grant, requireCapability, grantDecision } from './grant.js';
