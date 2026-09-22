-- PAS-0201 — Account Schema
--
-- Part I §6: "Keep platform user identity distinct from Authority Entity
-- identity. A user account may manage: one Personal PAS, multiple
-- organizations, shared organizational Authority Records, or delegated
-- authority. Therefore: User ≠ AuthorityEntity."
--
-- ── What each of the three tables is ──────────────────────────────────────
--
--   accounts             the tenant that OWNS authority. Part I §8 gives
--                        authority_entities an `owner_account_id`, so the
--                        owner is an account and never a user.
--   users                a human login. Never a subject of authority.
--   account_memberships  many-to-many. One account, many users — "account
--                        membership supports multiple users managing shared
--                        organizational authority". One user, many accounts —
--                        "a user account may manage … multiple organizations".
--
-- The many-to-many in both directions is what makes User ≠ AuthorityEntity
-- structural rather than a note. A user bound to one account could be quietly
-- treated as the subject it manages; a user in five accounts cannot.
--
-- ── What is deliberately NOT here ─────────────────────────────────────────
--
--   No credentials. Password hashes and their lifecycle are authentication
--   material and belong to PAS-0202, which is where `sessions` and
--   `authentication_events` are created.
--
--   No role column on account_memberships. Roles are PAS-0203
--   (`membership_roles`). A `role text` here would be this migration deciding
--   the authorization model one ticket early, and it is the kind of column
--   that never gets removed once something reads it.
--
--   No foreign key to authority_entities. That table is Build 04 (Part I §8).
--   The edge points from the entity to the account, not the reverse.

-- ── accounts ─────────────────────────────────────────────────────────────
create table accounts (
  id            uuid           primary key,
  account_type  text           not null,
  display_name  text           not null,
  status        text           not null default 'ACTIVE',
  created_at    timestamptz(3) not null,
  updated_at    timestamptz(3) not null,

  -- Text with a check rather than an enum. Part I §8 says the entity types
  -- are "initially" two, so more are expected; adding a value to a check is
  -- an ordinary migration, while ALTER TYPE ... ADD VALUE could not run
  -- inside a transaction before PG12 and still cannot be reversed in one.
  constraint accounts_account_type_check
    check (account_type in ('INDIVIDUAL', 'ORGANIZATION')),

  -- No hard deletes: authority outlives the account that owns it. Closing is
  -- a status, so a CLOSED account's records remain resolvable.
  constraint accounts_status_check
    check (status in ('ACTIVE', 'SUSPENDED', 'CLOSED')),

  constraint accounts_display_name_not_blank
    check (btrim(display_name) <> ''),

  -- PAS-0104. A row claiming it was modified before it existed breaks every
  -- "changed since" query that will ever be written against this table, and
  -- the right moment to find out is the write. The cost is explicit: a
  -- create-then-update inside the clock skew between two API instances is
  -- rejected rather than stored. PAS is not a system where sub-second
  -- cross-instance update is normal; revisit here if that stops being true.
  constraint accounts_updated_after_created
    check (updated_at >= created_at)
);

comment on table accounts is
  'The tenant that owns authority. Part I §8 authority_entities.owner_account_id points here.';

-- ── users ────────────────────────────────────────────────────────────────
create table users (
  id         uuid           primary key,
  email      text           not null,

  -- Uniqueness is enforced on the case-folded form, by the database.
  --
  -- Without it, 'Bob@Example.com' and 'bob@example.com' are two users who
  -- believe they are one — the account-recovery and duplicate-identity bug
  -- that every system with a plain unique index on `email` eventually has.
  -- A generated column cannot be bypassed by a writer that forgot to
  -- normalise, which application-side normalisation can.
  --
  -- Case folding only: no btrim(). `users_email_shape` below already refuses
  -- any address carrying leading or trailing whitespace, so trimming here
  -- would be unreachable — and a column that looks like it is defending
  -- against something it cannot reach is worse than one that does not claim
  -- to. Trimming belongs at the application boundary; the database refuses
  -- untrimmed input rather than silently storing an address it has altered,
  -- which would then be the address PAS sends mail to.
  --
  -- The address as entered is preserved for display and correspondence.
  email_normalized text generated always as (lower(email)) stored,

  status     text           not null default 'ACTIVE',
  created_at timestamptz(3) not null,
  updated_at timestamptz(3) not null,

  constraint users_status_check
    check (status in ('ACTIVE', 'SUSPENDED', 'DEACTIVATED')),

  -- Shape only. Real deliverability is proved by sending mail, not by a
  -- regular expression, and an over-strict pattern rejects valid addresses.
  constraint users_email_shape
    check (email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),

  constraint users_updated_after_created
    check (updated_at >= created_at)
);

create unique index users_email_normalized_key on users (email_normalized);

comment on table users is
  'A human login. Never a subject of authority — see account_memberships. User != AuthorityEntity (Part I §6).';

-- ── account_memberships ──────────────────────────────────────────────────
create table account_memberships (
  id         uuid           primary key,
  account_id uuid           not null,
  user_id    uuid           not null,
  status     text           not null default 'ACTIVE',
  created_at timestamptz(3) not null,
  updated_at timestamptz(3) not null,

  -- RESTRICT, not CASCADE. A membership disappearing because a row upstream
  -- was deleted is exactly the silent loss the no-hard-delete rule exists to
  -- prevent, and RESTRICT makes the database enforce it rather than trusting
  -- every future writer to remember.
  constraint account_memberships_account_fk
    foreign key (account_id) references accounts (id) on delete restrict,
  constraint account_memberships_user_fk
    foreign key (user_id) references users (id) on delete restrict,

  constraint account_memberships_status_check
    check (status in ('ACTIVE', 'SUSPENDED', 'REVOKED')),

  -- One membership per pair. Two ACTIVE rows for the same user and account
  -- would make "is this user a member?" depend on which row is read, and at
  -- PAS-0203 it would make their roles depend on it too.
  constraint account_memberships_unique unique (account_id, user_id),

  constraint account_memberships_updated_after_created
    check (updated_at >= created_at)
);

-- The unique constraint indexes (account_id, user_id), which serves "who is
-- in this account". "Which accounts does this user manage" — the Part I §6
-- question — reads the second column alone and needs its own index.
create index account_memberships_user_id_idx on account_memberships (user_id);

comment on table account_memberships is
  'Many-to-many: an account has many users, a user manages many accounts (Part I §6).';
