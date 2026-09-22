/**
 * PAS-0203/0204 — writing the registry.
 *
 * ── Why this exists, and how it was found ────────────────────────────────
 *
 * PAS-0203 created `membership_roles` and `capability_overrides` and seeded
 * the namespace. PAS-0204 reads them. **Nothing wrote them** — the registry
 * shipped with no write path at all, and the only code granting a role was a
 * raw INSERT in a test fixture.
 *
 * That surfaced when PAS-0204's own bypass guard flagged the fixture. The
 * choice was to widen the guard to accommodate the test, or to notice that a
 * registry nothing can write is an unfinished registry. The guard was right.
 *
 * These are the write path. They live here because this is where the tables'
 * invariants live: a role must exist, a capability must exist, an override
 * must carry a reason, and one membership holds a role once. Anything outside
 * `@pas/auth` that inserted these rows itself would be free to skip all four.
 *
 * **What calls them is not built yet.** Administrative flows — inviting a
 * collaborator, promoting an organization administrator, recording a
 * support-incident override — arrive with the routes that expose them. These
 * are the operations those flows will use, and they are authorized like
 * anything else: by their caller holding `organization.manage` or
 * `governance.admin`, checked with `requireCapability`.
 */

import { query, type PoolClient } from '@pas/database';
import { generateId } from '@pas/domain';
import { now } from '@pas/contracts';
import { type Capability, type Role } from './namespace.js';
import { type OverrideEffect } from './namespace.js';

/**
 * Grants a role to a membership. Idempotent.
 *
 * Re-granting is a no-op rather than an error: the operation an administrator
 * means by "make them an admin" is *ensure they are one*, and a second click
 * should not be a failure.
 */
export async function grantRole(
  accountMembershipId: string,
  role: Role,
  client?: PoolClient,
): Promise<void> {
  await query(
    `insert into membership_roles
       (id, account_membership_id, role_name, created_at, updated_at)
     values ($1, $2, $3, $4, $4)
     on conflict (account_membership_id, role_name) do nothing`,
    [generateId(), accountMembershipId, role, now()],
    { client, operation: 'auth.grant_role' },
  );
}

/** Revokes a role from a membership. Idempotent; returns whether one was held. */
export async function revokeRole(
  accountMembershipId: string,
  role: Role,
  client?: PoolClient,
): Promise<boolean> {
  const { rowCount } = await query(
    `delete from membership_roles where account_membership_id = $1 and role_name = $2`,
    [accountMembershipId, role],
    { client, operation: 'auth.revoke_role' },
  );
  return rowCount > 0;
}

/** The roles a membership holds. */
export async function rolesForMembership(
  accountMembershipId: string,
  client?: PoolClient,
): Promise<Role[]> {
  const { rows } = await query<{ role_name: Role }>(
    `select role_name from membership_roles where account_membership_id = $1 order by role_name`,
    [accountMembershipId],
    { client, operation: 'auth.roles_for_membership' },
  );
  return rows.map((r) => r.role_name);
}

/**
 * Sets a per-membership override.
 *
 * `reason` is required by the schema and by the signature, so it cannot be
 * omitted and filled in later. An override nobody can explain is one nobody
 * dares remove, and it will still be there during the incident review.
 *
 * Replaces any existing override for the pair, which is what makes reversing
 * a decision one call rather than a delete followed by an insert that could
 * fail in between.
 */
export async function setCapabilityOverride(
  accountMembershipId: string,
  capability: Capability,
  effect: OverrideEffect,
  reason: string,
  client?: PoolClient,
): Promise<void> {
  await query(
    `insert into capability_overrides
       (id, account_membership_id, capability_name, effect, reason, created_at, updated_at)
     values ($1, $2, $3, $4, $5, $6, $6)
     on conflict (account_membership_id, capability_name) do update
        set effect = excluded.effect,
            reason = excluded.reason,
            updated_at = excluded.updated_at`,
    [generateId(), accountMembershipId, capability, effect, reason, now()],
    { client, operation: 'auth.set_override' },
  );
}

/** Removes an override, returning the membership to whatever its roles grant. */
export async function clearCapabilityOverride(
  accountMembershipId: string,
  capability: Capability,
  client?: PoolClient,
): Promise<boolean> {
  const { rowCount } = await query(
    `delete from capability_overrides
      where account_membership_id = $1 and capability_name = $2`,
    [accountMembershipId, capability],
    { client, operation: 'auth.clear_override' },
  );
  return rowCount > 0;
}
