# PAS-0302 — Domain Event Envelope

## Ticket Completion Report

| Field | Value |
|---|---|
| **Ticket ID** | PAS-0302 |
| **Status** | ✅ **COMPLETE** |
| **Build** | 03 — Audit and Event Infrastructure |
| **Depends on** | PAS-0301 ✅ |

---

## Purpose

The shared event contract every domain event travels in. No database — PAS-0303 creates the
ledger; this is the shape it stores.

---

## Scope: thirteen fields, not twelve

PAS-0302 lists twelve. **Part I §21 adds `journey_id`, nullable**, and is binding. The union
is what was built — the same relationship PAS-0301 had with §23, and the same resolution:
the stricter of two Clean-Sheet statements governs, not whichever the ticket enumerated.

---

## Files Created

| Path | Purpose |
|---|---|
| `packages/events/src/actor.ts` | `ActorRef` — one attribution shape for audit and events |
| `packages/events/src/envelope/types.ts` | `DomainEvent`, `DomainEventInput`, `EVENT_TYPE_PATTERN` |
| `packages/events/src/envelope/create.ts` | `createDomainEvent` — validates in, deep-freezes out |
| `packages/events/src/envelope/validate.ts` | `isDomainEvent`, `assertDomainEvent`, `isEventOfType` |
| `packages/events/tests/envelope.test.ts` | 54 tests |

## Files Modified

| File | Change |
|---|---|
| `packages/events/src/audit/types.ts` | `AuditActor` is now an alias of `ActorRef` |
| `packages/events/src/index.ts` | exports the envelope and actor surface |

**No new dependency edges. No migration.**

---

## Decisions Made, Not Referred

### Two actor shapes, deliberately — and not three

Before this ticket there were two:

| | members |
|---|---|
| `@pas/auth` `Actor` | ANONYMOUS, USER |
| `@pas/events` `AuditActor` | ANONYMOUS, USER, **SYSTEM** |

The envelope needed an actor, and adding a third would be SUP-9's failure exactly — two
JSON-LD generators meant guarding one fixed nothing.

So audit and the envelope now share `ActorRef`, and `AuditActor` is an alias. PAS-0301's
surface is unchanged.

**They were not unified with `@pas/auth`'s `Actor`, and that is the decision.** Authorization
answers *may this request proceed*, and a request always has a requester — a person or nobody.
The set is closed, which is why PAS-0204 refuses anonymous before touching the database.
Attribution answers *who did this*, and work with no human behind it — a migration, a
scheduled job, the dispatcher — still has to be attributable. **Especially** that work,
because nobody is watching it.

Collapsing them would force authorization to handle SYSTEM, which silently answers a question
nobody has asked: what would it mean to authorize the dispatcher? The cost of keeping them
apart is one mapping at the boundary, which is the caller's and is trivial. The reasoning is
in `actor.ts` so the next person to notice two shapes finds out why before merging them.

### Immutable in fact, not in name — §21

> Events SHALL be immutable. Never edit an event to change history.

`readonly` is a compile-time claim a consumer reading a row out of the database never sees.
`createDomainEvent` **deep-freezes** what it returns, so a consumer handed an event cannot
mutate a payload and corrupt what the next consumer receives.

Deep-freezing recurses, and payloads come from callers, so the walk carries a `WeakSet` and
survives a cyclic object graph. A caller's object graph is not this module's to assume.

The actor is **copied** rather than referenced, so mutating the input afterwards cannot reach
the event.

There is **no update function anywhere in this module**, asserted by a test over the exports.

**There is deliberately no `supersedes` field.** §21 says corrective events may supersede
previous information — it states semantics and names no mechanism. Inventing one here would be
implementation deciding architecture (§LXI). A correction is a new event.

### `schemaVersion` lives on the envelope, not in a registry

An event outlives the code that wrote it. A consumer reading a five-year-old row needs to know
which payload shape it is holding, and a registry only ever describes today's.

The rule: increment on a breaking payload change; additive fields do not need one, because
consumers must ignore unknown keys. `isEventOfType(event, type, versions)` makes a consumer
state which versions it was written for, so one it does not know is refused rather than
destructured hopefully — a payload that changed shape otherwise reads as a payload with
missing fields.

### `ClaimApproved`, not `Claim.Approved`

PascalCase, matching Part I §5's worked example (`INSERT outbox_event ClaimApproved`). The
aggregate is already its own field, so prefixing duplicates it — and two places to read the
aggregate from is two places for them to disagree.

### Validated on the way in **and** on the way out

Not redundant. They fail for different reasons:

- **In** — the event is written in the same transaction as the mutation it describes (Part I
  §5), so a malformed one must fail *before* the mutation commits. Discovering it at read time
  means the change happened and its record is unusable.
- **Out** — a row may predate the current code by years, may have been written by a version
  with different rules, or may have arrived through a restore. `assertDomainEvent` names the
  offending field, because the caller is a dispatcher holding a row it cannot process and the
  useful output is which column to look at.

---

## Tests Added

**54 tests**, no database.

| Group | Tests |
|---|---|
| required fields | all thirteen, **with the values supplied**; `journeyId` specifically; every optional reference carried through; generated id and canonical timestamp; `schemaVersion` defaults to 1; correlation and causation inherited from the ambient context; optional references are `null`, not absent |
| **immutability** | a top-level write throws; **a write inside the payload throws**; a write to the actor throws; mutating the input actor cannot reach the event; a cyclic payload does not hang the freeze; no editing export |
| refuses to be built | six malformed event types; nine invalid field combinations; `undefined` payload refused but `{}` accepted; **every problem named at once**, not the first |
| refuses to be read | six non-objects; nine field-level corruptions; names the offending field; a timestamp that names the right moment but is not PAS-0104 canonical |
| consumer narrowing | known type and version; a version it was not written for; a different type at a version it knows |
| one actor shape | the envelope and audit accept the same actor; exactly three attribution kinds |

### Mutation testing

Seventeen mutations, **seventeen detected** — after one survivor was closed.

| Mutation | Result |
|---|---|
| deep freeze removed | 4 failed |
| freeze made shallow | 3 failed |
| cycle guard removed | 1 failed |
| actor referenced instead of copied | 1 failed |
| event-type pattern loosened | 6 failed |
| actor validation disabled | 3 failed |
| `undefined` payload accepted | 1 failed |
| schema version unchecked | 4 failed |
| correlation not inherited | 1 failed |
| validator stops checking the instant | 2 failed |
| validator accepts any object | 12 failed |
| SYSTEM actor with a user id accepted | 1 failed |
| version narrowing ignored | 1 failed |
| **`journeyId` hard-coded to null** | **survived → 3 failed** |
| `authorityEntityId` hard-coded to null | 2 failed |
| `causationId` hard-coded to null | 3 failed |

**The survivor is the finding.** The thirteen-field test asserted the *key set* and the
default-value test asserted `journeyId` is `null` when not supplied. Neither asserts a supplied
value is carried — so hard-coding `journeyId: null` passed both.

It landed on the one field PAS-0302 omits and §21 requires: the field this ticket went out of
its way to add, and therefore the one most likely to be silently dropped. Every optional
reference defaults to `null`, so the same hole existed for all five. The test now asserts
values rather than keys, and a second test round-trips every optional reference — verified by
running the same mutation against `authorityEntityId` and `causationId` too.

Two mutations were initially "detected" only by the **typecheck**, which proves the mutation
was invalid rather than that the tests cover the behaviour. Both were rebuilt to compile; one
then failed twelve tests, the other survived and became the finding above.

---

## Security / Privacy Impact

Minimal — this is a contract with no I/O.

- **Events are frozen**, so a malicious or careless consumer cannot alter what a later consumer
  receives.
- **An event cannot be edited**, which is what makes the ledger (PAS-0303) an audit trail
  rather than a cache.
- **No redaction here.** Payloads are scrubbed where they are *written*, by PAS-0303, for the
  same reason audit scrubs at the writer: the envelope is a shape, not a boundary. Recorded so
  it is not assumed to happen here.

---

## Backward Dependency Check

No new edges. `apps/web` is a dependency of nothing. Re-verified.

**ADR-002 sweep:** Build 03's opening sweep ran at PAS-0301. This ticket adds no consumer and
changes no data's meaning, visibility, lifecycle or governance. The one existing consumer of an
actor shape — PAS-0301's audit ledger — was changed to share `ActorRef`, which is the sweep's
requirement applied rather than avoided.

---

## Known Issues

**None that hide an unmet acceptance criterion.**

1. **Nothing emits domain events yet.** No governed mutation exists. The envelope binds from
   the first one, Build 04 onward.
2. **No payload schema registry.** Deliberate: `schemaVersion` travels on the envelope so an
   old row is self-describing. A registry describing today's shapes can be added later without
   changing the envelope, which is the point of putting the version on the row.
3. **No `supersedes` field.** §21 names semantics, not a mechanism. Deciding one here would be
   implementation deciding architecture.
4. **Payload redaction happens at the writer, not here.** See *Security*.

---

## Acceptance Criteria

| Criterion | Status |
|---|---|
| Create a shared event contract | ✅ `packages/events/src/envelope/` |
| eventId · eventType · schemaVersion · aggregateType · aggregateId | ✅ |
| authorityEntityId · authorityRecordId | ✅ nullable, carried through, tested |
| actor · correlationId · causationId | ✅ one shared actor shape; correlation inherited from PAS-0004 |
| payload · occurredAt | ✅ `undefined` refused, `{}` accepted; PAS-0104 `OccurredAt` |
| Part I §21: `journey_id` nullable | ✅ the thirteenth field, and the one the mutation sweep caught |
| Part I §21: events SHALL be immutable | ✅ deep-frozen, cycle-safe, no editing export |
| Part I §21: never edit an event to change history | ✅ no update path exists |

**No criterion is unmet. STATUS = COMPLETE.**
