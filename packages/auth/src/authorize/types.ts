/**
 * PAS-0204 — the shapes an authorization decision is made from and reported in.
 */

import { type Capability } from '../capabilities/namespace.js';

/**
 * Who is asking.
 *
 * Anonymous is a **first-class actor**, not `null` or `undefined`. A signature
 * taking `Actor | null` invites `authorize(maybeUser, …)` where `maybeUser` is
 * undefined for a reason nobody checked, and an authorization call that can be
 * passed a nullish actor by accident is one that will be.
 */
export type Actor =
  | { readonly kind: 'ANONYMOUS' }
  | { readonly kind: 'USER'; readonly userId: string };

export const ANONYMOUS: Actor = Object.freeze({ kind: 'ANONYMOUS' as const });

export function actorForUser(userId: string): Actor {
  return { kind: 'USER', userId };
}

/**
 * What is being acted on.
 *
 * ── Why the caller supplies the account, and does not get to guess ────────
 *
 * Authorization answers "may this actor do X **to that thing**", so it needs
 * to know which account owns the thing. Resolving a resource to its owning
 * account requires `authority_entities`, which is Build 04 (Part I §8,
 * `owner_account_id`).
 *
 * Rather than stub that resolution here and have it silently disagree with the
 * real one later, the caller states the owning account. This service stays a
 * pure decision over membership and capability, and resource-to-account
 * resolution lives with the resources when they exist.
 *
 * **The cost, stated:** a caller that supplies the wrong account gets a
 * confidently wrong answer. That is why this is a tagged union rather than a
 * bare string — `authorize(actor, cap, someId)` does not compile, and
 * `{ scope: 'ACCOUNT', accountId }` is hard to write by accident.
 */
export type ResourceContext =
  | { readonly scope: 'ACCOUNT'; readonly accountId: string }
  | { readonly scope: 'PLATFORM' };

export function inAccount(accountId: string): ResourceContext {
  return { scope: 'ACCOUNT', accountId };
}

export const PLATFORM_SCOPE: ResourceContext = Object.freeze({ scope: 'PLATFORM' as const });

/** Why a request was allowed. Internal. */
export type AllowReason =
  /** A role on the actor's membership grants the capability. */
  | 'ROLE_GRANT'
  /** A `capability_overrides` row with effect ALLOW. */
  | 'EXPLICIT_ALLOW';

/**
 * Why a request was refused. **Internal — never put on the wire.**
 *
 * These distinguish "you are not a member of that account" from "you were
 * specifically denied this capability", which tells a prober about an
 * account's structure and membership. One refusal goes to the caller;
 * the distinction is for the audit record.
 */
export type DenyReason =
  | 'ANONYMOUS'
  /** The capability is not in the namespace. Fail closed. */
  | 'UNKNOWN_CAPABILITY'
  /** No membership joins this actor to this account — or neither exists. */
  | 'NO_MEMBERSHIP'
  | 'MEMBERSHIP_NOT_ACTIVE'
  | 'ACCOUNT_NOT_ACTIVE'
  | 'USER_NOT_ACTIVE'
  /** A membership in good standing that simply does not hold the capability. */
  | 'NO_CAPABILITY'
  /** A `capability_overrides` row with effect DENY. */
  | 'EXPLICIT_DENY';

export interface AuthorizationDecision {
  readonly decision: 'ALLOW' | 'DENY';
  readonly capability: string;
  readonly reason: AllowReason | DenyReason;
  readonly actor: Actor;
  readonly scope: 'ACCOUNT' | 'PLATFORM';
  /** The account the decision was made against. Resolved, for PLATFORM scope. */
  readonly accountId?: string;
  /** The membership the decision was made through, when one was found. */
  readonly membershipId?: string;
  /** PAS-0004, so a decision can be tied to the request that caused it. */
  readonly correlationId?: string;
}

export function isAllowed(
  decision: AuthorizationDecision,
): decision is AuthorizationDecision & { decision: 'ALLOW' } {
  return decision.decision === 'ALLOW';
}

export type { Capability };
