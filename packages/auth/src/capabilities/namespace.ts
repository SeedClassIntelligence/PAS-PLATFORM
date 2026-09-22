/**
 * PAS-0203 — the canonical capability namespace.
 *
 * Part I §7, verbatim. This constant and the `capabilities` table are two
 * copies of one list, which is a real cost accepted for a reason: callers need
 * a name the compiler checks, and the database needs a foreign key so a grant
 * naming a capability that does not exist is refused at write time rather than
 * silently never matching at authorization time.
 *
 * Drift between them is caught mechanically — a test asserts the seeded rows
 * and this array are the same set — rather than left to whoever remembers.
 *
 * *"Expand without changing authorization architecture."* Adding a capability
 * is a row in a new migration plus an entry here, and nothing else.
 */

export const CAPABILITIES = [
  'authority.entity.create',
  'authority.entity.read',
  'authority.entity.update',
  'authority.record.read',
  'authority.record.read_private',
  'authority.record.update',
  'source.create',
  'source.read',
  'source.delete',
  'claim.create',
  'claim.review',
  'claim.approve',
  'evidence.create',
  'evidence.review',
  'evidence.verify',
  'experience.create',
  'experience.review',
  'composition.create',
  'composition.approve',
  'representation.create',
  'representation.approve',
  'publication.publish',
  'publication.unpublish',
  'fellowship.interact',
  'relationship.manage',
  'opportunity.manage',
  'organization.manage',
  'governance.admin',
  'audit.read',
  'platform.admin',
] as const;

/**
 * A capability name the compiler checks.
 *
 * `authorize(actor, 'authorty.entity.read', …)` does not compile. Without
 * this it would compile, always deny, and look like a permissions bug.
 */
export type Capability = (typeof CAPABILITIES)[number];

const CAPABILITY_SET: ReadonlySet<string> = new Set(CAPABILITIES);

export function isCapability(value: unknown): value is Capability {
  return typeof value === 'string' && CAPABILITY_SET.has(value);
}

/**
 * The roles PAS-0205 names as actors.
 *
 * "Anonymous" and "unauthorized" are absent deliberately. They are the
 * *absence* of a grant, and a row representing "no access" is a row somebody
 * can grant by mistake.
 */
export const ROLES = [
  'OWNER',
  'COLLABORATOR',
  'ORGANIZATION_ADMIN',
  'PLATFORM_ADMIN',
] as const;

export type Role = (typeof ROLES)[number];

/**
 * Capabilities the specification defines but no seeded role holds.
 *
 * Not an oversight, and asserted by a test so it cannot quietly become one.
 *
 * INV-27 keeps knowledge authority and action authority separate; INV-12 makes
 * source confirmation strictly weaker than verification; SUP-12 records what
 * the baseline does without that separation — typing a sentence into a modal
 * produces `PUBLISH_READY`, `PUBLIC` authority with a confidence of 100.
 *
 * Granting `OWNER` the power to approve its own claims would reproduce SUP-12
 * at the authorization layer, where it is far harder to see. These exist so
 * the gate exists; they are held by nobody so the gate cannot yet be
 * satisfied. The build that defines the review workflow (Builds 08–11) defines
 * who carries them.
 */
export const UNHELD_CAPABILITIES = [
  'claim.review',
  'claim.approve',
  'evidence.review',
  'evidence.verify',
  'experience.review',
  'composition.approve',
  'representation.approve',
] as const satisfies readonly Capability[];

/** `accounts.account_type` — ADR-007 added `PLATFORM`. */
export const ACCOUNT_TYPES = ['INDIVIDUAL', 'ORGANIZATION', 'PLATFORM'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/** `capability_overrides.effect`. DENY wins over any role grant. */
export const OVERRIDE_EFFECTS = ['ALLOW', 'DENY'] as const;
export type OverrideEffect = (typeof OVERRIDE_EFFECTS)[number];
