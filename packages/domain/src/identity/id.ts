/**
 * PAS-0103 — the Canonical ID Service.
 *
 * §XLI: *"IDs must be durable and non-semantic. Do not encode `M01`, `d01` or
 * presentation assumptions into authority identity. Authority survives
 * redesign. Representation IDs and authority IDs remain separate."*
 *
 * The ticket names what must never appear inside an identifier: entity type,
 * module, dossier, page, owner name, sequence meaning.
 *
 * ── Non-semantic is structural here, not a convention ─────────────────────
 *
 * `generateId()` takes no arguments. It cannot encode the entity type, the
 * module, the owner or anything else, because it is never told any of them.
 * A generator that accepted a prefix would be one deadline away from
 * `generateId('auth')`, and the first time an identifier carries meaning is
 * the last time it is free to change.
 *
 * ── Why UUIDv4, and specifically not v7 or ULID ───────────────────────────
 *
 * v7 and ULID are the current default advice, because a time-ordered
 * identifier gives a B-tree good insert locality where a random one
 * fragments it.
 *
 * They are both disqualified by the same clause. A v7 or ULID *is* a
 * timestamp with random padding: sorting the identifiers recovers creation
 * order, and creation order is "sequence meaning". It would also leak, to
 * anyone holding two identifiers, when each record was created — which is
 * information about the subject of a PAS, not about the row.
 *
 * The index-locality cost is real and is accepted. If it is ever measured to
 * matter, the answer is a separate insert-ordered column that the schema owns,
 * never meaning smuggled back into the identity.
 *
 * ── Durable ───────────────────────────────────────────────────────────────
 *
 * Durable means an identifier never has to change, which requires that it was
 * never derived from anything that can. A v4 identifier is 122 bits of
 * randomness and is a function of nothing — not the record, not the time, not
 * the owner. Rename the subject, re-model the dossier, replace the module
 * scheme: none of it touches identity. That is what "authority survives
 * redesign" means in practice.
 *
 * ── An identifier is not a capability ─────────────────────────────────────
 *
 * These are unguessable, and that must never be mistaken for a security
 * property. Knowing an identifier authorizes nothing. Authorization is
 * PAS-0203/PAS-0204's capability registry, checked on every access. An
 * identifier in a URL is a name, not a key.
 */

import { randomUUID } from 'node:crypto';
import { ValidationError } from '@pas/contracts';

declare const idBrand: unique symbol;

/**
 * A canonical identifier.
 *
 * `Scope` is a **compile-time** discriminator and has no representation in the
 * value. §XLI requires representation identifiers and authority identifiers to
 * remain separate; the separation belongs in the type system, because the
 * moment it lives in the string the identifier has become semantic.
 *
 * Later builds declare their own:
 *
 * ```ts
 * type AuthorityEntityId = Id<'AuthorityEntity'>;
 * type RepresentationId  = Id<'Representation'>;
 * ```
 *
 * and the compiler then refuses to pass one where the other belongs, while
 * both remain indistinguishable on the wire and in the database.
 *
 * No scopes are declared here. The entities do not exist yet (Build 04), and
 * naming them now would be implementation deciding architecture.
 */
export type Id<Scope extends string = string> = string & {
  readonly [idBrand]: Scope;
};

/**
 * The canonical form: lowercase hyphenated UUID, version 4.
 *
 * The version nibble and the variant bits are pinned rather than accepting any
 * UUID shape. This is the regression guard that fails the day someone swaps in
 * a v7 generator for the index-locality win and reintroduces sequence meaning
 * without noticing.
 */
export const ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/**
 * The nil UUID.
 *
 * It is what an uninitialised field, a zeroed struct and a defaulted column
 * all produce, and accepting it as identity is how "unset" quietly becomes a
 * real record that every row can point at.
 *
 * `ID_PATTERN` already rejects it — the nil UUID has `0` where the version
 * nibble must be `4` — so this is not a second check anywhere. It exists so
 * `parseId` can say *which* thing is wrong, because "must not be the nil
 * identifier" sends an integrator to the right line and "must be a canonical
 * PAS identifier" does not.
 */
export const NIL_ID = '00000000-0000-0000-0000-000000000000';

/**
 * A new canonical identifier.
 *
 * Takes no arguments, deliberately. See the header.
 *
 * `randomUUID` draws from the platform CSPRNG, so identifiers are not
 * predictable from one another — see the note above on why that is not a
 * security property.
 */
export function generateId<Scope extends string = string>(): Id<Scope> {
  return randomUUID() as Id<Scope>;
}

/**
 * Whether a value is already in canonical form.
 *
 * Strict: the canonical form is what PAS stores and what PostgreSQL returns
 * from a `uuid` column. Anything else is normalised by `parseId` first, so
 * that two spellings of the same identifier can never both be in circulation.
 */
export function isId<Scope extends string = string>(value: unknown): value is Id<Scope> {
  return typeof value === 'string' && ID_PATTERN.test(value);
}

/**
 * Normalises an identifier arriving from outside PAS — a request path, a query
 * parameter, an imported record.
 *
 * Accepts surrounding whitespace and uppercase hex, because both are common
 * from upstream systems and neither changes which record is meant. Emits the
 * canonical form, so a single record can never be addressed by two strings
 * that compare unequal.
 *
 * Throws rather than returning null: an unparseable identifier is a bad
 * request, and `ValidationError` is what the error contract renders as one.
 * The rejected value is NOT echoed — it is caller-supplied and reaches logs
 * and error bodies.
 */
export function parseId<Scope extends string = string>(
  value: unknown,
  field = 'id',
): Id<Scope> {
  if (typeof value !== 'string') {
    throw new ValidationError('The identifier is not valid.', [
      { path: field, message: 'must be a string' },
    ]);
  }

  const normalised = value.trim().toLowerCase();

  // Not a second rejection — `ID_PATTERN` below already excludes it. This
  // only reaches it first so the message names the actual mistake.
  if (normalised === NIL_ID) {
    throw new ValidationError('The identifier is not valid.', [
      { path: field, message: 'must not be the nil identifier' },
    ]);
  }

  if (!ID_PATTERN.test(normalised)) {
    throw new ValidationError('The identifier is not valid.', [
      { path: field, message: 'must be a canonical PAS identifier' },
    ]);
  }

  return normalised as Id<Scope>;
}

/**
 * Asserts that a value produced *inside* PAS is a canonical identifier.
 *
 * Distinct from `parseId` on purpose. `parseId` handles untrusted input and
 * normalises it; this one states an internal invariant and normalises nothing,
 * because a value that needed normalising did not come from where the caller
 * thought it did.
 */
export function assertId<Scope extends string = string>(
  value: unknown,
  what = 'identifier',
): Id<Scope> {
  if (!isId<Scope>(value)) {
    throw new ValidationError(`Expected a canonical ${what}.`, [
      { path: what, message: 'is not a canonical PAS identifier' },
    ]);
  }
  return value;
}
