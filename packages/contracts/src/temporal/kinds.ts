/**
 * PAS-0104 — the seven timestamp semantics.
 *
 * *"Domain contracts SHALL distinguish when necessary: createdAt, updatedAt,
 * occurredAt, validFrom, validTo, publishedAt, observedAt. Do not overload
 * createdAt to represent real-world occurrence."*
 *
 * ── Why these are separate types and not seven names for `string` ─────────
 *
 * "Do not overload `createdAt`" is a rule a person has to remember, and the
 * PAS baseline is what happens when they do not. `auth-asg-cdc` carries
 * `createdAt: '2015-01-01'` — the year A Solution Group CDC was founded, not
 * the moment the record was written, which was whenever the page last loaded.
 * `PeerEndorsement.createdAt` carries `'1 week ago'`. See SUP-14.
 *
 * Nothing about `string` resisted either one. Branding the kinds moves the
 * rule from review to the compiler:
 *
 * ```ts
 * const founded: OccurredAt = toOccurredAt('2015-01-01T00:00:00Z');
 * const record: CreatedAt = founded;   // does not compile
 * ```
 *
 * The values remain identical on the wire and in the database. The separation
 * is in the type system, exactly as identity's is (PAS-0103, §XLI).
 *
 * ── Two clocks, and why conflating them destroys evidence ─────────────────
 *
 * PAS makes claims about the world and has to be able to say where each one
 * came from. That needs two independent timelines:
 *
 *   the world's   when the thing happened          occurredAt
 *                 when the assertion holds         validFrom / validTo
 *
 *   PAS's         when PAS learned it              observedAt
 *                 when PAS wrote the record        createdAt
 *                 when PAS last changed it         updatedAt
 *                 when PAS showed it publicly      publishedAt
 *
 * Collapsing them costs specific things. If `occurredAt` is written into
 * `createdAt`, a record whose founding date is 2015 sorts as though PAS has
 * held it for a decade, and "what did we know, and when?" becomes
 * unanswerable — which is the question an authority platform exists to
 * answer. If `observedAt` is dropped, a claim ingested today about a 2015
 * event is indistinguishable from one PAS has carried since 2015.
 */

import { type Instant, toInstant, now } from './instant.js';

/**
 * When the **record** came into existence in PAS.
 *
 * A property of the row, never of its subject. The founding date of an
 * organisation, the date a credential was awarded and the date a document was
 * signed are all `occurredAt`.
 *
 * Set once and never again.
 */
export type CreatedAt = Instant<'createdAt'>;

/** When the record was last modified in PAS. A property of the row. */
export type UpdatedAt = Instant<'updatedAt'>;

/**
 * When the thing happened in the **real world**.
 *
 * The field `createdAt` is forbidden from carrying. It may precede
 * `createdAt` by decades, and it may be in the future for a scheduled event.
 */
export type OccurredAt = Instant<'occurredAt'>;

/**
 * When PAS **observed** it — ingested the document, ran the extraction,
 * received the connector payload, recorded the interview answer.
 *
 * Distinct from `createdAt`: an import can observe a thousand records in one
 * batch that PAS then writes over several minutes, and distinct from
 * `occurredAt`: observing something in 2026 says nothing about when it
 * happened. This is the timestamp that makes provenance answerable.
 */
export type ObservedAt = Instant<'observedAt'>;

/**
 * Start of the interval over which an assertion holds. **Inclusive.**
 *
 * A role held, a certification in force, an agreement in effect. See
 * `interval.ts` for the half-open convention.
 */
export type ValidFrom = Instant<'validFrom'>;

/** End of that interval. **Exclusive.** `null` means open-ended. */
export type ValidTo = Instant<'validTo'>;

/**
 * When a projection was published to a public surface.
 *
 * §INV-3: the Published PAS is a projection of the Authority Record, so this
 * belongs to the publication, never to the record it projects. A record that
 * has been published four times has one `createdAt` and four `publishedAt`.
 */
export type PublishedAt = Instant<'publishedAt'>;

/**
 * The canonical record envelope's timestamps (§XL, "Created/updated
 * timestamps").
 */
export interface RecordTimestamps {
  createdAt: CreatedAt;
  updatedAt: UpdatedAt;
}

/**
 * Timestamps for a newly created record, **from a single clock read**.
 *
 * The cheapest test for "has this record ever been modified?" is
 * `createdAt === updatedAt`, and two `now()` calls break it — but not in the
 * way it first appears, and the difference matters.
 *
 * `Date.now()` has millisecond resolution, so two consecutive reads land in
 * the same millisecond almost every time and the pair looks correct in
 * testing. They differ only when the call happens to straddle a millisecond
 * boundary. That makes the defect *intermittent*, which is worse than
 * consistent: a small, random fraction of freshly created records claim to
 * have been modified, the rate depends on machine speed and load, and nobody
 * can reproduce it.
 *
 * One read makes the test true by construction on a new record, and false
 * forever after the first update.
 */
export function newRecordTimestamps(): RecordTimestamps {
  const instant = now();
  return { createdAt: instant as CreatedAt, updatedAt: instant as UpdatedAt };
}

/** The `updatedAt` for a record being modified now. */
export function touch(): UpdatedAt {
  return now<'updatedAt'>();
}

/**
 * Parsers for the kinds that legitimately arrive as input.
 *
 * `createdAt` and `updatedAt` have no parser here on purpose. They are facts
 * about what PAS did, so they come from `newRecordTimestamps` and `touch` —
 * from the clock, never from a payload. Hydrating a row read back out of the
 * database is `assertInstant`, which is named differently precisely so that
 * using it in a create path reads wrong.
 */
export const toOccurredAt = (value: unknown, field = 'occurredAt'): OccurredAt =>
  toInstant<'occurredAt'>(value, field);

export const toObservedAt = (value: unknown, field = 'observedAt'): ObservedAt =>
  toInstant<'observedAt'>(value, field);

export const toValidFrom = (value: unknown, field = 'validFrom'): ValidFrom =>
  toInstant<'validFrom'>(value, field);

export const toValidTo = (value: unknown, field = 'validTo'): ValidTo =>
  toInstant<'validTo'>(value, field);

export const toPublishedAt = (value: unknown, field = 'publishedAt'): PublishedAt =>
  toInstant<'publishedAt'>(value, field);
