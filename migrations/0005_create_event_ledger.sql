-- PAS-0303 — Event Ledger
--
-- "Create immutable: domain_events. Application code may append. Application
--  code may not edit historical events."
--
-- Part I §21's required envelope, which PAS-0302 implements in TypeScript and
-- this stores. Thirteen fields: PAS-0302's twelve plus `journey_id`, which §21
-- requires and PAS-0302's own list omits.
--
-- ── Immutable means the database refuses, not that callers behave ────────
--
-- > Events SHALL be immutable. Never edit an event to change history.
-- > Corrective events may supersede previous information.
--
-- An event is a statement that something happened. Editing one does not
-- correct the past — it destroys the only record of it, while every consumer
-- that already processed the original keeps a version nobody can now see.
--
-- UPDATE and DELETE raise from triggers, the same pattern as `audit_entries`.
-- A correction is a new event; there is no `supersedes` column because §21
-- states the semantics and names no mechanism, and inventing one here would be
-- implementation deciding architecture (§LXI).

create table domain_events (
  -- ── Ordering, and here it is load-bearing ──────────────────────────────
  --
  -- PAS-0301 found that millisecond timestamps (PAS-0104) plus random
  -- identifiers (PAS-0103) leave rows written in the same millisecond with no
  -- defined order. In `audit_entries` that cost legibility.
  --
  -- Here it costs correctness: PAS-0305's dispatcher claims and delivers work
  -- in order, and consumers that rebuild state from the ledger replay in
  -- order. An ambiguous sequence is a state divergence, not an inconvenience.
  --
  -- Same caveats as audit: assigned at INSERT rather than COMMIT, and gapped
  -- by rolled-back transactions. It is an ordering, never a count.
  sequence             bigserial      not null,

  event_id             uuid           primary key,
  event_type           text           not null,
  schema_version       integer        not null,

  aggregate_type       text           not null,
  aggregate_id         text           not null,

  authority_entity_id  uuid,
  authority_record_id  uuid,
  -- Part I §21: "journey_id nullable".
  journey_id           uuid,

  -- Matches `audit_entries`: one attribution shape across both ledgers
  -- (PAS-0302's ActorRef).
  actor_type           text           not null,
  actor_id             uuid,

  correlation_id       text,
  causation_id         text,

  -- The canonical record of what happened. NOT scrubbed — see
  -- `packages/events/src/ledger/append.ts`. A payload carrying anything
  -- shaped like a credential is REFUSED at write time, because this table
  -- cannot be corrected afterwards.
  payload              jsonb          not null,

  occurred_at          timestamptz(3) not null,
  -- When the row was written, as distinct from when the thing happened. They
  -- differ when an event records a moment that had already passed.
  recorded_at          timestamptz(3) not null,

  -- PascalCase, matching Part I §5's `INSERT outbox_event ClaimApproved`. The
  -- aggregate is its own column, so a prefixed type would duplicate it.
  constraint domain_events_event_type_shape
    check (event_type ~ '^[A-Z][A-Za-z0-9]*$'),

  constraint domain_events_schema_version_positive
    check (schema_version >= 1),

  constraint domain_events_aggregate_type_not_blank
    check (btrim(aggregate_type) <> ''),
  constraint domain_events_aggregate_id_not_blank
    check (btrim(aggregate_id) <> ''),

  constraint domain_events_actor_type_check
    check (actor_type in ('USER', 'SYSTEM', 'ANONYMOUS')),
  -- A SYSTEM row carrying a user id reads, during an investigation, as that
  -- user having done it.
  constraint domain_events_actor_id_matches_type
    check ((actor_type = 'USER') = (actor_id is not null)),

  -- jsonb accepts scalars and arrays; an event payload is a record.
  constraint domain_events_payload_is_object
    check (jsonb_typeof(payload) = 'object'),

  constraint domain_events_recorded_after_occurred
    check (recorded_at >= occurred_at)
);

create unique index domain_events_sequence_key on domain_events (sequence);

-- "Everything that happened to this aggregate, in order" — the read a
-- consumer rebuilding state performs.
create index domain_events_aggregate_idx
  on domain_events (aggregate_type, aggregate_id, sequence);

-- "Everything of this type" — how a consumer catches up after a deployment.
create index domain_events_type_idx on domain_events (event_type, sequence);

-- PAS-0004: what makes one action legible across API, worker and outbox.
create index domain_events_correlation_idx
  on domain_events (correlation_id) where correlation_id is not null;

create index domain_events_occurred_at_idx on domain_events (occurred_at desc);

comment on table domain_events is
  'Immutable (Part I §21). Append-only; corrections are new events, never edits.';

-- ── Append-only, enforced ────────────────────────────────────────────────
create or replace function domain_events_immutable() returns trigger as $$
begin
  raise exception 'domain_events is immutable: % is not permitted (Part I §21)', tg_op
    using errcode = 'restrict_violation';
end;
$$ language plpgsql;

create trigger domain_events_no_update
  before update on domain_events
  for each row execute function domain_events_immutable();

create trigger domain_events_no_delete
  before delete on domain_events
  for each row execute function domain_events_immutable();
