-- PAS-0301 — Audit Ledger
--
-- PAS-0301 requires: id, actorType, actorId, action, targetType, targetId,
-- authorityEntityId (nullable), correlationId, metadata, occurredAt.
--
-- Part I §23 requires more, and is binding: actor, action, target,
-- **before/after reference where appropriate**, **authorization result**,
-- **governance decision**, correlation ID, timestamp, and **origin**.
-- "Administrative activity must also be audited."
--
-- The union is what is built here. PAS-0301's list is the minimum, not the
-- ceiling.
--
-- ── Written in the same transaction as the thing it records ──────────────
--
-- Part I §5's worked example is explicit:
--
--   BEGIN
--     UPDATE claim …
--     INSERT claim_version …
--     INSERT audit_entry …
--     INSERT outbox_event ClaimApproved …
--   COMMIT
--
-- Audit is not fire-and-forget telemetry. A mutation that commits without its
-- audit entry is a change nobody can account for, and an audit entry that
-- commits without its mutation is a record of something that never happened.
-- Both are one transaction or neither is.
--
-- ── Append-only, enforced by the database ────────────────────────────────
--
-- An audit record a caller can revise is not an audit record. UPDATE and
-- DELETE are refused by a trigger rather than by convention, because the
-- person who needs to edit the audit log is exactly the person who must not
-- be able to.

create table audit_entries (
  id                   uuid           primary key,

  -- ── Insertion order, because a timestamp is not enough ─────────────────
  --
  -- PAS-0104 fixes canonical timestamps at millisecond precision, and
  -- PAS-0103 makes identifiers random with no sequence meaning. Both are
  -- right, and together they leave entries written inside the same
  -- millisecond with **no defined order** — `order by occurred_at, id` falls
  -- back to comparing random UUIDs. A test caught exactly that: three entries
  -- in a loop came back shuffled.
  --
  -- "What happened first" is a core audit question, so the ledger owns an
  -- ordering column rather than inferring one. This is the remedy PAS-0103's
  -- report already named: *a separate insert-ordered column that the schema
  -- owns, never meaning smuggled back into identity.*
  --
  -- Caveats, stated because a sequence invites two wrong assumptions:
  --   • It is assigned at INSERT, not at COMMIT, so a long transaction can
  --     hold a lower number and land later. Within Part I §5's pattern the
  --     entry commits with its mutation, so this orders operations as they
  --     happened.
  --   • Rolled-back transactions consume numbers. Gaps are expected; this is
  --     an ordering, never a count.
  sequence             bigserial      not null,

  occurred_at          timestamptz(3) not null,

  -- ── actor ──────────────────────────────────────────────────────────────
  -- Mirrors PAS-0204's Actor. SYSTEM covers work with no human behind it —
  -- a migration, a scheduled job, the dispatcher — which must be auditable
  -- precisely because nobody is watching it.
  actor_type           text           not null,
  -- Null for SYSTEM and ANONYMOUS. No foreign key to `users`: an audit row
  -- that a future delete could orphan is not an audit row, and the user it
  -- names must remain readable after the account is closed.
  actor_id             uuid,

  -- ── action and target ──────────────────────────────────────────────────
  action               text           not null,
  target_type          text           not null,
  -- Text, not uuid. Targets include capabilities and roles, which are named
  -- (PAS-0203), as well as entities, which are not.
  target_id            text           not null,

  -- Nullable per PAS-0301, and no foreign key: `authority_entities` is
  -- Build 04, and audit must outlive whatever it refers to regardless.
  authority_entity_id  uuid,

  -- ── §23: before/after REFERENCE, not value ────────────────────────────
  -- A reference — a version id, a snapshot id — because copying the values
  -- into the audit log duplicates whatever made them sensitive, into the one
  -- table that is never deleted.
  before_ref           text,
  after_ref            text,

  -- ── §23: authorization result ──────────────────────────────────────────
  -- Where PAS-0204's decision lands. Recorded for the *action*, not for every
  -- permission check: an audit row per read-authorization would be a write
  -- per read, and the interesting fact is what was permitted, not what was
  -- asked.
  authorization_result text,
  -- Internal, exactly as in PAS-0204: it distinguishes "not a member" from
  -- "explicitly denied" and never leaves the server.
  authorization_reason text,

  -- ── §23: governance decision ───────────────────────────────────────────
  governance_decision  text,

  -- ── ADR-004: origin ────────────────────────────────────────────────────
  -- "Origin affects provenance and policy, never whether governance exists."
  -- Recorded so a later question — was this asserted by a person or proposed
  -- by an extractor — is answerable from the record rather than inferred.
  origin               text           not null,

  correlation_id       text,

  -- Scrubbed before it arrives (PAS-0003's `scrubDetails`). The column is not
  -- a place to put a request body.
  metadata             jsonb          not null default '{}'::jsonb,

  constraint audit_entries_actor_type_check
    check (actor_type in ('USER', 'SYSTEM', 'ANONYMOUS')),

  -- An actor id without a user, or a user without an id, is a row nobody can
  -- interpret during an investigation.
  constraint audit_entries_actor_id_matches_type
    check ((actor_type = 'USER') = (actor_id is not null)),

  constraint audit_entries_authorization_result_check
    check (authorization_result is null or authorization_result in ('ALLOW', 'DENY')),

  -- ADR-004's list. Text with a check rather than an enum, for the same
  -- reason as PAS-0201: origins will be added.
  constraint audit_entries_origin_check
    check (origin in (
      'AI', 'DOCUMENT', 'WEB', 'CONNECTOR', 'MANUAL_ENTRY', 'GAP_INTERVIEW',
      'ADMIN', 'SYSTEM'
    )),

  constraint audit_entries_action_not_blank check (btrim(action) <> ''),
  constraint audit_entries_target_type_not_blank check (btrim(target_type) <> ''),
  constraint audit_entries_target_id_not_blank check (btrim(target_id) <> ''),

  -- jsonb accepts scalars and arrays; an audit row's metadata is a record.
  constraint audit_entries_metadata_is_object
    check (jsonb_typeof(metadata) = 'object')
);

-- "What did this actor do?" — the first question of any investigation.
create index audit_entries_actor_idx
  on audit_entries (actor_id, occurred_at desc) where actor_id is not null;

-- "What happened to this thing?"
create index audit_entries_target_idx on audit_entries (target_type, target_id, occurred_at desc);

-- "What else happened in the request that did this?" — PAS-0004's correlation
-- id is what makes one action legible across the API, the worker and the
-- outbox.
create index audit_entries_correlation_idx
  on audit_entries (correlation_id) where correlation_id is not null;

create index audit_entries_occurred_at_idx on audit_entries (occurred_at desc);

-- The total order. Unique so nothing can write a duplicate position.
create unique index audit_entries_sequence_key on audit_entries (sequence);

comment on table audit_entries is
  'Append-only. Written in the same transaction as the mutation it records (Part I §5).';

-- ── Append-only, enforced ────────────────────────────────────────────────
create or replace function audit_entries_immutable() returns trigger as $$
begin
  raise exception 'audit_entries is append-only: % is not permitted', tg_op
    using errcode = 'restrict_violation';
end;
$$ language plpgsql;

create trigger audit_entries_no_update
  before update on audit_entries
  for each row execute function audit_entries_immutable();

create trigger audit_entries_no_delete
  before delete on audit_entries
  for each row execute function audit_entries_immutable();
