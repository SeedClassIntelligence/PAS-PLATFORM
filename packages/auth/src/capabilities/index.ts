/** PAS-0203 — Capability Registry. */

export {
  type Capability,
  type Role,
  type AccountType,
  type OverrideEffect,
  CAPABILITIES,
  ROLES,
  UNHELD_CAPABILITIES,
  ACCOUNT_TYPES,
  OVERRIDE_EFFECTS,
  isCapability,
} from './namespace.js';

export { platformAccountId, resetPlatformAccountCache } from './platform.js';
