/**
 * PAS-0204 — making the call obligatory.
 *
 * *"All protected server operations must call this service or an equivalent
 *  centralized enforcement mechanism."*
 *
 * A centralized service nobody is obliged to call is decoration. The usual
 * enforcement — a route wrapper, or a lint rule — needs routes to exist, and
 * the first one arrives at PAS-0405. Waiting for it would mean every operation
 * written between now and then relies on its author remembering.
 *
 * So the obligation is in the type system, which is available today.
 *
 * A protected operation takes a `Grant` for the capability it needs:
 *
 * ```ts
 * async function createClaim(grant: Grant<'claim.create'>, input: ClaimInput) {
 *   …
 * }
 * ```
 *
 * `Grant` has a private brand and no exported constructor, so the **only** way
 * to obtain one is `requireCapability`, which produces it from an ALLOW. The
 * function cannot be called without one, cannot be given a grant for a
 * different capability, and cannot have one forged. Forgetting to authorize is
 * not a review finding — it is a compile error.
 *
 * This does not replace a route-level check; it composes with one. It bounds
 * the damage a forgotten wrapper can do, which is the part a wrapper cannot do
 * for itself.
 */

import { AuthorizationError } from '@pas/contracts';
import { type PoolClient } from '@pas/database';
import { type Capability } from '../capabilities/namespace.js';
import { authorize } from './authorize.js';
import { type Actor, type ResourceContext, type AuthorizationDecision } from './types.js';

declare const grantBrand: unique symbol;

/**
 * Proof that `authorize` returned ALLOW for this capability.
 *
 * The brand is declared and never exported, so no caller can construct the
 * type. `as Grant<'claim.create'>` is the one remaining escape, and it is
 * greppable in review in a way that a missing call is not.
 */
export interface Grant<C extends Capability> {
  readonly [grantBrand]: C;
  readonly capability: C;
  /** Carried so the operation can record what authorized it. */
  readonly decision: AuthorizationDecision;
}

/**
 * Authorizes, or throws.
 *
 * The thrown `AuthorizationError` carries the capability — PAS-0003 settled
 * that as client-safe, and telling a caller which permission they lack is
 * useful rather than a leak, since they already know what they attempted.
 *
 * It carries **no reason**. `NO_MEMBERSHIP` versus `EXPLICIT_DENY` tells a
 * prober whether an account exists and whether they were singled out. That
 * distinction stays in the returned decision and in the audit record.
 */
export async function requireCapability<C extends Capability>(
  actor: Actor,
  capability: C,
  resource: ResourceContext,
  client?: PoolClient,
): Promise<Grant<C>> {
  const decision = await authorize(actor, capability, resource, client);

  if (decision.decision !== 'ALLOW') {
    throw new AuthorizationError(undefined, { capability });
  }

  return { capability, decision } as Grant<C>;
}

/**
 * The decision behind a grant, for an operation that records what authorized
 * it.
 *
 * A plain property read, deliberately not a method on `Grant`: a grant with
 * behaviour is a grant somebody will subclass or stub.
 */
export function grantDecision<C extends Capability>(grant: Grant<C>): AuthorizationDecision {
  return grant.decision;
}
