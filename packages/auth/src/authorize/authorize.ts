/**
 * PAS-0204 — the authorization service.
 *
 * *"All protected server operations must call this service or an equivalent
 *  centralized enforcement mechanism. Return explicit ALLOW / DENY with
 *  internal reason information for audit."*
 *
 * ── Resolution order, and why it is this order ────────────────────────────
 *
 *   1  anonymous                          → DENY
 *   2  capability outside the namespace   → DENY   (fail closed)
 *   3  no membership joining actor→account→ DENY
 *   4  user, account or membership not ACTIVE → DENY
 *   5  override DENY                      → DENY
 *   6  override ALLOW                     → ALLOW
 *   7  a role on the membership grants it → ALLOW
 *   8  otherwise                          → DENY
 *
 * Status (4) is checked **before** an ALLOW override (6) on purpose. An
 * override says which *capability* a membership has; it says nothing about
 * whether the principal is live. A suspended user holding an ALLOW override
 * must still be refused, or suspension is not suspension.
 *
 * DENY overrides beat role grants because the schema makes ALLOW and DENY for
 * one membership and capability mutually exclusive (PAS-0203), so there is no
 * override-versus-override case — only override versus role, and the
 * narrower, explicitly-reasoned row wins.
 *
 * ── One query ─────────────────────────────────────────────────────────────
 *
 * Everything the decision needs is read in a single statement. Not for speed:
 * separate reads of membership, status, override and grants could observe
 * different moments, so a capability revoked between two of them would still
 * authorize. One statement is one snapshot.
 *
 * ── Errors are not denials ────────────────────────────────────────────────
 *
 * A database failure propagates. It does **not** become DENY. A 403 for an
 * outage sends the on-call engineer to debug permissions, and it hides the
 * outage behind a plausible answer. Fail closed means "no decision is an
 * allow"; it does not mean "every failure is a refusal".
 */

import { query, type PoolClient } from '@pas/database';
import { correlationFields } from '@pas/observability';
import { type Capability, isCapability } from '../capabilities/namespace.js';
import { platformAccountId } from '../capabilities/platform.js';
import {
  type Actor,
  type ResourceContext,
  type AuthorizationDecision,
  type AllowReason,
  type DenyReason,
} from './types.js';

interface ResolutionRow {
  user_status: string;
  account_status: string;
  membership_id: string;
  membership_status: string;
  override_effect: 'ALLOW' | 'DENY' | null;
  has_role_grant: boolean;
}

function decide(
  base: Omit<AuthorizationDecision, 'decision' | 'reason'>,
  decision: 'ALLOW' | 'DENY',
  reason: AllowReason | DenyReason,
): AuthorizationDecision {
  return { ...base, decision, reason };
}

/**
 * Decides whether `actor` may exercise `capability` against `resource`.
 *
 * Never throws for a refusal — a refusal is a value. It throws only when the
 * decision could not be made at all, which is not a refusal (see the header).
 */
export async function authorize(
  actor: Actor,
  capability: Capability | string,
  resource: ResourceContext,
  client?: PoolClient,
): Promise<AuthorizationDecision> {
  const { correlationId } = correlationFields();

  const base = {
    capability,
    actor,
    scope: resource.scope,
    accountId: resource.scope === 'ACCOUNT' ? resource.accountId : undefined,
    correlationId,
  } satisfies Omit<AuthorizationDecision, 'decision' | 'reason'>;

  if (actor.kind !== 'USER') {
    return decide(base, 'DENY', 'ANONYMOUS');
  }

  // The type system rules this out for callers inside PAS; a value arriving
  // as JSON does not go through the type system. An unrecognised capability
  // is refused rather than looked up, so a typo can never match a row.
  if (!isCapability(capability)) {
    return decide(base, 'DENY', 'UNKNOWN_CAPABILITY');
  }

  const accountId =
    resource.scope === 'ACCOUNT' ? resource.accountId : await platformAccountId(client);

  const { rows } = await query<ResolutionRow>(
    `select
       u.status                as user_status,
       a.status                as account_status,
       m.id                    as membership_id,
       m.status                as membership_status,
       o.effect                as override_effect,
       exists (
         select 1
           from membership_roles mr
           join role_capabilities rc on rc.role_name = mr.role_name
          where mr.account_membership_id = m.id
            and rc.capability_name = $3
       )                       as has_role_grant
     from account_memberships m
       join users u    on u.id = m.user_id
       join accounts a on a.id = m.account_id
       left join capability_overrides o
         on o.account_membership_id = m.id and o.capability_name = $3
     where m.user_id = $1 and m.account_id = $2`,
    [actor.userId, accountId, capability],
    { client, operation: 'auth.authorize' },
  );

  const resolved = { ...base, accountId };

  // No row covers three cases — no such user, no such account, no membership
  // joining them — and deliberately does not distinguish them. Telling a
  // caller which would confirm whether an account exists.
  if (rows.length === 0) {
    return decide(resolved, 'DENY', 'NO_MEMBERSHIP');
  }

  const row = rows[0];
  const withMembership = { ...resolved, membershipId: row.membership_id };

  if (row.user_status !== 'ACTIVE') {
    return decide(withMembership, 'DENY', 'USER_NOT_ACTIVE');
  }
  if (row.account_status !== 'ACTIVE') {
    return decide(withMembership, 'DENY', 'ACCOUNT_NOT_ACTIVE');
  }
  if (row.membership_status !== 'ACTIVE') {
    return decide(withMembership, 'DENY', 'MEMBERSHIP_NOT_ACTIVE');
  }

  if (row.override_effect === 'DENY') {
    return decide(withMembership, 'DENY', 'EXPLICIT_DENY');
  }
  if (row.override_effect === 'ALLOW') {
    return decide(withMembership, 'ALLOW', 'EXPLICIT_ALLOW');
  }
  if (row.has_role_grant) {
    return decide(withMembership, 'ALLOW', 'ROLE_GRANT');
  }

  return decide(withMembership, 'DENY', 'NO_CAPABILITY');
}
