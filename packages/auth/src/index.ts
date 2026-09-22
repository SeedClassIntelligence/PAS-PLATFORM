/**
 * `@pas/auth` — authentication and sessions (PAS-0202).
 *
 * The capability registry (PAS-0203) and the authorization service (PAS-0204)
 * land here next. Nothing in this package decides what a user may *do*.
 */

export {
  type ScryptParameters,
  hashPassword,
  verifyPassword,
  needsRehash,
  assertAcceptablePassword,
  configuredParameters,
} from './password/hash.js';

export {
  newSessionToken,
  hashSessionToken,
  sessionTokenMatches,
} from './session/tokens.js';

export {
  type Session,
  type IssuedSession,
  type SessionRejection,
  type SessionResolution,
  issueSession,
  resolveSession,
  revokeSession,
  revokeAllSessionsForUser,
} from './session/sessions.js';

export {
  type AuthenticationEventType,
  type AuthenticationEvent,
  type RequestContext,
  recordAuthenticationEvent,
  countRecentFailures,
} from './events.js';

export * from './capabilities/index.js';

export {
  type LoginFailure,
  type LoginResult,
  login,
  setPassword,
} from './authenticate.js';
