-- PAS-0202 — Authentication
--
-- "Implement secure authentication/session infrastructure. Create: sessions,
--  authentication_events. Authentication and Authority Entity identity remain
--  separate."
--
-- ── Three tables, and why credentials are not a column on `users` ─────────
--
-- `user_credentials` is separate so that the ordinary read path for a user
-- never carries the hash. `select * from users` is written a hundred times
-- over a codebase's life, in handlers, in joins, in debug logging; every one
-- of those is a place a password hash can reach a log or a response body. A
-- hash that lives in another table cannot be selected by accident.
--
-- It also gives credentials their own lifecycle. A user is one row forever; a
-- credential is replaced on every password change, and the replacement wants
-- its own created_at for "when did this password start" without disturbing
-- the user's.
--
-- ── What is deliberately NOT stored ───────────────────────────────────────
--
--   The session token. Only its SHA-256. A stolen database then yields no
--   usable session — see `sessions.token_hash`.
--
--   The email address attempted in a failed login for a user that does not
--   exist. See `authentication_events`.
--
--   Anything linking a session to an Authority Entity. A session identifies a
--   *user*; what that user may do about a subject of authority is reached
--   through account_memberships, and decided by PAS-0204.

-- ── user_credentials ─────────────────────────────────────────────────────
create table user_credentials (
  id         uuid           primary key,
  user_id    uuid           not null,

  -- Self-describing: algorithm and parameters travel with the hash.
  --
  --   scrypt$ln=16,r=8,p=1$<salt base64url>$<derived key base64url>
  --
  -- This is what makes the cost raisable and the algorithm replaceable. A bare
  -- hash column forces every stored password to share whatever parameters the
  -- code currently uses, so raising the cost either invalidates every existing
  -- password or silently never applies. Here, a hash below current policy is
  -- recognised as such and re-hashed on the owner's next successful login,
  -- with no migration and no forced reset.
  password_hash text        not null,

  created_at timestamptz(3) not null,
  updated_at timestamptz(3) not null,

  constraint user_credentials_user_fk
    foreign key (user_id) references users (id) on delete restrict,

  -- One live credential per user. Password *history*, if it is ever required,
  -- is a separate table: history has different retention and must never be a
  -- candidate for authentication.
  constraint user_credentials_user_unique unique (user_id),

  -- Shape only, so a plaintext password written here by mistake is refused by
  -- the database rather than stored and later "verified" against itself.
  constraint user_credentials_hash_shape
    check (password_hash ~ '^scrypt\$ln=[0-9]+,r=[0-9]+,p=[0-9]+\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$'),

  constraint user_credentials_updated_after_created
    check (updated_at >= created_at)
);

comment on table user_credentials is
  'Password material. Separate from users so the ordinary read path cannot carry a hash.';

-- ── sessions ─────────────────────────────────────────────────────────────
create table sessions (
  id         uuid           primary key,
  user_id    uuid           not null,

  -- The SHA-256 of the token, never the token.
  --
  -- The token is 256 bits of CSPRNG output handed to the client once. Storing
  -- only its digest means a database disclosure — a backup, a replica, a log
  -- of a query plan — hands an attacker nothing they can present as a session.
  -- Reversing SHA-256 of 256 random bits is not a dictionary problem, so no
  -- password-style KDF is needed or wanted on the lookup path.
  token_hash bytea          not null,

  created_at    timestamptz(3) not null,
  updated_at    timestamptz(3) not null,

  -- Absolute expiry: this session ends at this instant however active it is.
  expires_at    timestamptz(3) not null,
  -- Idle expiry is computed from this against the configured idle window.
  last_seen_at  timestamptz(3) not null,
  -- Set, never deleted. A revoked session must stay auditable.
  revoked_at    timestamptz(3),
  revoked_reason text,

  constraint sessions_user_fk
    foreign key (user_id) references users (id) on delete restrict,

  constraint sessions_expires_after_created
    check (expires_at > created_at),
  constraint sessions_last_seen_after_created
    check (last_seen_at >= created_at),
  constraint sessions_updated_after_created
    check (updated_at >= created_at),
  -- A reason without a revocation, or a revocation without a reason, is a row
  -- nobody can interpret six months later during an incident.
  constraint sessions_revocation_complete
    check ((revoked_at is null) = (revoked_reason is null))
);

-- Every authenticated request resolves a session by token digest. It is the
-- hottest lookup in the system and must be a single index probe.
create unique index sessions_token_hash_key on sessions (token_hash);

-- "Revoke everything for this user" — password change, compromise, support
-- request — reads by user.
create index sessions_user_id_idx on sessions (user_id);

comment on table sessions is
  'Identifies a USER, never an Authority Entity (PAS-0202). Stores the token digest, never the token.';

-- ── authentication_events ────────────────────────────────────────────────
--
-- Append-only. No update or delete path is provided, and PAS-0301's audit
-- ledger will subsume the general case; this one exists now because a failed
-- login that leaves no trace is indistinguishable from no login attempt, and
-- lockout (PAS-0002's maxFailedAttempts) has to count something.
create table authentication_events (
  id         uuid           primary key,

  -- Null when the attempt named a user that does not exist.
  --
  -- The attempted address is deliberately NOT recorded in that case. The
  -- operational need — detecting credential stuffing — is served by counting
  -- attempts per source, while recording arbitrary typed strings produces a
  -- permanent log of other people's addresses and, whenever someone types
  -- their password into the email field, of their password.
  user_id    uuid,

  event_type text           not null,
  occurred_at timestamptz(3) not null,

  -- Null when the request arrived without one, or through a channel that has
  -- none. Truncated by the writer; the column is not a free-text sink.
  source_ip   inet,
  user_agent  text,

  -- The session this event concerns, where there is one. No foreign key: the
  -- event outlives the session, and an audit row that could be made
  -- unreadable by a future delete is not an audit row.
  session_id  uuid,

  constraint authentication_events_user_fk
    foreign key (user_id) references users (id) on delete restrict,

  constraint authentication_events_type_check
    check (event_type in (
      'LOGIN_SUCCEEDED',
      'LOGIN_FAILED',
      'LOGIN_BLOCKED',
      'LOGOUT',
      'SESSION_REVOKED',
      'CREDENTIAL_SET',
      'CREDENTIAL_REHASHED'
    )),

  constraint authentication_events_user_agent_length
    check (user_agent is null or length(user_agent) <= 512)
);

-- Lockout asks "how many failures for this user since T". Both columns, in
-- this order, because the predicate is an equality then a range.
create index authentication_events_user_occurred_idx
  on authentication_events (user_id, occurred_at desc);

-- Credential stuffing asks the same question per source address.
create index authentication_events_ip_occurred_idx
  on authentication_events (source_ip, occurred_at desc)
  where source_ip is not null;

comment on table authentication_events is
  'Append-only. Never stores a password, a token, or the address attempted for an unknown user.';
