-- PAS-0203 — Capability Registry
--
-- "Authorization SHALL operate through explicit capabilities." (Part I §7)
-- "Seed the canonical capability namespace established in the Master Build
--  Specification."
--
-- ── ADR-007: the grain is membership, and the platform is an account ──────
--
-- Part I §6 names `user_capability_overrides`; PAS-0203 names
-- `capability_overrides`. The latter, because the grain is the question and
-- §6's own model answers it: roles attach to a membership, since a user who
-- administers one organization does not thereby administer another. A row
-- keyed by `user_id` would grant the capability in *every* account that user
-- belongs to — a tenant-isolation breach with a table name on it.
--
-- Platform-level capabilities are the one real argument for a user grain. They
-- are handled by making the platform an account: a platform administrator
-- holds a membership like anyone else. `authorize()` then has one grain and no
-- branch, and holding `platform.admin` requires a row that can be listed,
-- audited and revoked.

-- ── The platform account ─────────────────────────────────────────────────

alter table accounts drop constraint accounts_account_type_check;
alter table accounts add constraint accounts_account_type_check
  check (account_type in ('INDIVIDUAL', 'ORGANIZATION', 'PLATFORM'));

-- Exactly one, enforced. "The platform" admitting a second row is a second
-- set of platform administrators nobody is looking at.
create unique index accounts_single_platform_account
  on accounts ((true)) where account_type = 'PLATFORM';

-- `gen_random_uuid()` rather than a recognisable constant like
-- 0000…0001. PAS-0103 forbids semantic identifiers, and "this one is special"
-- is meaning. Callers resolve the platform account by `account_type`, of which
-- there is provably one; nothing needs to know its id in advance.
--
-- `now()` is the transaction timestamp, and a migration is the one place a
-- timestamp legitimately comes from the database: there is no application
-- running to supply one.
insert into accounts (id, account_type, display_name, status, created_at, updated_at)
values (gen_random_uuid(), 'PLATFORM', 'PAS Platform', 'ACTIVE', now(), now());

-- ── capabilities ─────────────────────────────────────────────────────────
--
-- The name is the primary key. PAS-0103's non-semantic rule governs the
-- identity of records *about the world* — an entity, a claim, a piece of
-- evidence — whose identifiers must survive every rename. A capability name is
-- not that: it is a constant the specification itself writes down, referenced
-- by name in code and in grants. A surrogate key here would mean every role
-- grant reads as a pair of opaque uuids, and a typo in a grant would be
-- unreadable rather than refused by a foreign key.
create table capabilities (
  name        text           primary key,
  description text           not null,
  created_at  timestamptz(3) not null,

  constraint capabilities_name_shape
    check (name ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  constraint capabilities_description_not_blank
    check (btrim(description) <> '')
);

comment on table capabilities is
  'The canonical namespace (Part I §7). Expand by adding rows in a new migration.';

-- ── roles ────────────────────────────────────────────────────────────────
create table roles (
  name        text           primary key,
  description text           not null,
  created_at  timestamptz(3) not null,

  constraint roles_name_shape check (name ~ '^[A-Z][A-Z0-9_]*$'),
  constraint roles_description_not_blank check (btrim(description) <> '')
);

-- ── role_capabilities ────────────────────────────────────────────────────
create table role_capabilities (
  role_name       text           not null,
  capability_name text           not null,
  created_at      timestamptz(3) not null,

  primary key (role_name, capability_name),
  constraint role_capabilities_role_fk
    foreign key (role_name) references roles (name) on delete restrict,
  -- The reason capabilities are a table and not an enum in code: a grant
  -- naming a capability that does not exist is refused here, at write time,
  -- rather than silently never matching at authorization time.
  constraint role_capabilities_capability_fk
    foreign key (capability_name) references capabilities (name) on delete restrict
);

create index role_capabilities_capability_idx on role_capabilities (capability_name);

-- ── membership_roles ─────────────────────────────────────────────────────
create table membership_roles (
  id                    uuid           primary key,
  account_membership_id uuid           not null,
  role_name             text           not null,
  created_at            timestamptz(3) not null,
  updated_at            timestamptz(3) not null,

  constraint membership_roles_membership_fk
    foreign key (account_membership_id) references account_memberships (id) on delete restrict,
  constraint membership_roles_role_fk
    foreign key (role_name) references roles (name) on delete restrict,

  -- One grant per pair. Two rows would make "does this membership hold this
  -- role" depend on which is read, and revoking it depend on finding both.
  constraint membership_roles_unique unique (account_membership_id, role_name),
  constraint membership_roles_updated_after_created check (updated_at >= created_at)
);

create index membership_roles_role_idx on membership_roles (role_name);

-- ── capability_overrides ─────────────────────────────────────────────────
--
-- Grants AND revokes. An override that could only grant is half a mechanism:
-- withdrawing one capability from one membership would otherwise require
-- inventing a bespoke role, and bespoke roles are how a role model becomes
-- unauditable.
create table capability_overrides (
  id                    uuid           primary key,
  account_membership_id uuid           not null,
  capability_name       text           not null,
  effect                text           not null,

  -- Not nullable. An override nobody can explain is one nobody dares remove,
  -- and it will still be there during the incident review.
  reason                text           not null,

  created_at            timestamptz(3) not null,
  updated_at            timestamptz(3) not null,

  constraint capability_overrides_membership_fk
    foreign key (account_membership_id) references account_memberships (id) on delete restrict,
  constraint capability_overrides_capability_fk
    foreign key (capability_name) references capabilities (name) on delete restrict,

  constraint capability_overrides_effect_check check (effect in ('ALLOW', 'DENY')),
  constraint capability_overrides_reason_not_blank check (btrim(reason) <> ''),

  -- One override per membership and capability, so ALLOW and DENY can never
  -- both be present for the same pair. Resolution order is then a rule about
  -- roles versus overrides only, and never about which override wins.
  constraint capability_overrides_unique unique (account_membership_id, capability_name),
  constraint capability_overrides_updated_after_created check (updated_at >= created_at)
);

create index capability_overrides_capability_idx on capability_overrides (capability_name);

comment on table capability_overrides is
  'Per-membership grant or revoke (ADR-007). DENY wins over any role grant.';

-- ── Seed: the canonical namespace, Part I §7 verbatim ────────────────────
insert into capabilities (name, description, created_at) values
  ('authority.entity.create',      'Create an Authority Entity',                      now()),
  ('authority.entity.read',        'Read an Authority Entity',                        now()),
  ('authority.entity.update',      'Update an Authority Entity',                      now()),
  ('authority.record.read',        'Read an Authority Record',                        now()),
  ('authority.record.read_private','Read non-public material on an Authority Record',  now()),
  ('authority.record.update',      'Update an Authority Record',                      now()),
  ('source.create',                'Attach a source',                                 now()),
  ('source.read',                  'Read a source',                                   now()),
  ('source.delete',                'Delete a source',                                 now()),
  ('claim.create',                 'Assert a claim',                                  now()),
  ('claim.review',                 'Review a claim',                                  now()),
  ('claim.approve',                'Approve a claim',                                 now()),
  ('evidence.create',              'Attach evidence',                                 now()),
  ('evidence.review',              'Review evidence',                                 now()),
  ('evidence.verify',              'Independently verify evidence',                   now()),
  ('experience.create',            'Record an experience',                            now()),
  ('experience.review',            'Review an experience',                            now()),
  ('composition.create',           'Create a composition',                            now()),
  ('composition.approve',          'Approve a composition',                           now()),
  ('representation.create',        'Create a representation',                         now()),
  ('representation.approve',       'Approve a representation',                        now()),
  ('publication.publish',          'Publish a representation',                        now()),
  ('publication.unpublish',        'Withdraw a publication',                          now()),
  ('fellowship.interact',          'Participate in Fellowship',                       now()),
  ('relationship.manage',          'Manage relationships',                            now()),
  ('opportunity.manage',           'Manage opportunities',                            now()),
  ('organization.manage',          'Administer an organization account',              now()),
  ('governance.admin',             'Administer governance configuration',             now()),
  ('audit.read',                   'Read the audit record',                           now()),
  ('platform.admin',               'Administer the platform',                         now());

-- ── Seed: roles ──────────────────────────────────────────────────────────
--
-- The four PAS-0205 names as actors. "Anonymous" and "unauthorized" are not
-- roles — they are the absence of a grant, and modelling them as rows would
-- create something that can be granted by mistake.
insert into roles (name, description, created_at) values
  ('OWNER',              'Holds the account and the authority it owns',        now()),
  ('COLLABORATOR',       'Works on the account''s authority by invitation',    now()),
  ('ORGANIZATION_ADMIN', 'Administers an organization account and its members', now()),
  ('PLATFORM_ADMIN',     'Administers the platform',                           now());

-- ── Seed: role → capability ──────────────────────────────────────────────
--
-- ── Why no role holds claim.approve, evidence.verify or the review and
--    approval capabilities ─────────────────────────────────────────────────
--
-- INV-27: "Knowledge authority and action authority remain separate. Gates G2
-- and G4 are distinct and separately authorized." INV-12: source confirmation
-- is strictly weaker than verification. SUP-12 records what happens without
-- that separation — in the baseline, typing a sentence into a modal produces
-- `PUBLISH_READY`, `PUBLIC`, `confidenceScore: 100` authority.
--
-- Granting OWNER the capability to approve its own claims reproduces SUP-12 at
-- the authorization layer, where it would be much harder to see. So these six
-- capabilities are seeded and granted to **no role**:
--
--   claim.review  claim.approve  evidence.review  evidence.verify
--   experience.review  composition.approve  representation.approve
--
-- They exist, so the gate exists and is referenceable. They are held by nobody,
-- so the gate cannot currently be satisfied by anyone — which is the correct
-- state until the build that defines the review workflow (Builds 08–11) also
-- defines who carries it. Inventing a REVIEWER role here, with guessed
-- semantics, would be implementation deciding architecture.
--
-- A test asserts exactly which capabilities are held by no role, so that set
-- stays deliberate rather than becoming an accident nobody re-reads.
--
-- ── Why publication.publish IS granted to OWNER ──────────────────────────
--
-- A Personal PAS its owner cannot publish is not a product. The separation is
-- preserved elsewhere and more precisely: INV-3 makes the Published PAS a
-- *projection* of the Authority Record, so publishing exposes only what has
-- already passed its gates. Gating the projection rather than the content
-- would be the wrong control in the wrong place.
--
-- ── Why PLATFORM_ADMIN does not hold authority.record.read_private ───────
--
-- A platform administrator is not thereby authorized over every account's
-- private records. That is precisely the "god view" recorded against
-- `MasterAdminView` (`docs/RECONCILIATION.md` Part 7). Cross-account access to
-- private material is an explicit, reasoned, auditable `capability_overrides`
-- row — not a property of being an administrator.

insert into role_capabilities (role_name, capability_name, created_at)
select 'OWNER', name, now() from capabilities where name in (
  'authority.entity.create', 'authority.entity.read', 'authority.entity.update',
  'authority.record.read', 'authority.record.read_private', 'authority.record.update',
  'source.create', 'source.read', 'source.delete',
  'claim.create', 'evidence.create', 'experience.create',
  'composition.create', 'representation.create',
  'publication.publish', 'publication.unpublish',
  'fellowship.interact', 'relationship.manage', 'opportunity.manage'
);

insert into role_capabilities (role_name, capability_name, created_at)
select 'COLLABORATOR', name, now() from capabilities where name in (
  'authority.entity.read',
  'authority.record.read',
  'source.create', 'source.read',
  'claim.create', 'evidence.create', 'experience.create',
  'composition.create', 'representation.create',
  'fellowship.interact'
);
-- Deliberately absent from COLLABORATOR: authority.record.read_private,
-- source.delete, publication.*, relationship.manage, opportunity.manage.
-- A collaborator who needs private read gets an explicit override with a
-- reason attached, which is exactly the case capability_overrides exists for.

insert into role_capabilities (role_name, capability_name, created_at)
select 'ORGANIZATION_ADMIN', name, now() from capabilities where name in (
  'authority.entity.create', 'authority.entity.read', 'authority.entity.update',
  'authority.record.read', 'authority.record.read_private', 'authority.record.update',
  'source.create', 'source.read', 'source.delete',
  'claim.create', 'evidence.create', 'experience.create',
  'composition.create', 'representation.create',
  'publication.publish', 'publication.unpublish',
  'fellowship.interact', 'relationship.manage', 'opportunity.manage',
  'organization.manage'
);

insert into role_capabilities (role_name, capability_name, created_at)
select 'PLATFORM_ADMIN', name, now() from capabilities where name in (
  'governance.admin', 'audit.read', 'platform.admin'
);
