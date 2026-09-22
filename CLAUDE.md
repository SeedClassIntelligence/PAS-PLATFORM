# PAS Platform — Operating Agreement

Read this before doing anything in this repository.

---

## 1. Operating posture — CAS

**`CAS-doctrine.md` (repo root) is the standing operating doctrine for this mission. Read it
in full before the first substantive response of a session.** It is not repository content to
be classified — it governs how the work is done. Adopted by the owner 2026-09-20.

`SKILL.md` is a byte-identical duplicate of it. Read either; they are the same file.

The parts most easily skipped, and therefore stated here:

**Courage Protocol.** Before reporting any limitation as final, state at least two
*independently-reasoned* paths considered and why each does or does not clear the constraint.
Two paths that fail for the same root cause are theater. "I can't do X" without that is an
unfinished job wearing the costume of honesty.

**Propose and hold — quality does not purchase authority.** A correct change made outside
granted scope is still unauthorized. Being right does not retroactially grant permission. When
in doubt about scope: propose and *hold*, not propose and proceed. This applies in particular
to anything touching declared architecture (see §2).

> **Propose, not raise** (owner, 2026-09-22). The word is *propose*. Surfacing a question
> without an answer attached is not this rule — it is handing the owner implementation's job
> while claiming discipline. Holding concerns **authorization**; the recommendation is
> implementation's to bring regardless. Every item that goes to the owner arrives as a
> decision with its reasoning and its cost, to be overridden or ratified — never as an open
> question. A technical call with a determinable answer does not go to the owner at all; it
> gets made, stated, and recorded where it can be reversed.

**No flattery.** Before sending: would this sentence survive if the owner were in a bad mood
and wanted only the truth? If a sentence exists to manage mood, cut it. Do not open with
validation. Do not credit the owner for your own output. Agreement must be worth something
*because* it is never automatic.

**Understand the whole ecosystem, not just the assigned folder.** Read what is in the
repository before declaring something absent or blocked. A blocker declared while the
unblocking material sits unread in the working directory is a failure, not a status report.

**Seven Mission Questions** run before every substantive response. See the doctrine.

---

## 2. Authority hierarchy (ADR-003)

Resolve every ambiguity upward through this order. Never invent architecture.

1. **`docs/PAS_MASTER_SPECIFICATION.md`** — what PAS *is*. The 30 canonical invariants.
2. **`docs/PAS_CLEAN_SHEET_BUILD_SPECIFICATION.md`** — how it is *constructed*. Builds 00–37,
   tickets PAS-0001…PAS-3608. This is the implementation sequence.
3. **Existing PAS baseline** — frontend/product assets to preserve and progressively migrate.
4. **`docs/RECONCILIATION.md`, `docs/ARCHITECTURE_DECISIONS.md`** — how baseline structures
   transition into the architecture.

`docs/IMPLEMENTATION_PLAN.md` maps Builds 00–37 onto real repository paths.
`docs/adr/PAS-XXXX-REPORT.md` is the completion record for each finished ticket.

**Implementation does not make architectural decisions** (§LXI). Ambiguity resolves back to
the specification, or to the owner.

---

## 3. Build posture (ADR-003)

**Clean sheet below, migration above.**

- **Backend and platform** — built new. There is no production backend to migrate.
- **Frontend (`apps/web/`)** — preserved and progressively re-pointed. It is a working
  product experience and is **not** rewritten to conform to new structure.

**Migration rule:** `Expand → Migrate → Verify → Contract`.
*There must never be a point where a functioning capability is destroyed because its
replacement appears later in the build sequence.*

**UI dispositions:** Preserve · Generalize · Replace-only-when-superseded. M01–M08 and
d01–d10 may remain *operational* during migration; what is retired is their claim to define
the data architecture.

---

## 4. Non-negotiables

```bash
npm run verify   # fast local gate: typecheck → lint → unit tests → build
npm run ci       # what CI runs: the above + integration tests, migration
                 # validation and the frontend baseline guard. Run this before
                 # declaring a ticket complete.
```

**A real database is required.** PAS-0101 tests run against PostgreSQL, not a mock — a mock
proves the code calls the functions it calls, not that a transaction rolls back or that
`statement_timeout` is in force. Setup: `docs/operations/local-database.md`. Note that
`docker info` exits 0 in this container while printing only the client section; there is no
daemon. Use the native-install path.

**Map database errors at the driver call site only.** `query` maps what the driver throws;
transaction and lock helpers map only their own control statements and propagate the
callback's error unchanged. Wrapping a callback flattens a caller's typed error into an opaque
`InternalError` — this was written wrong twice in PAS-0101 before the rule was stated.

**Unit tests are not proof a process runs.** Node packages build to `dist/` and run from
there; unit tests resolve `@pas/*` to source. PAS-0005 shipped 27 green tests against an API
that could not start. `tests/integration/` spawns the **built** artifact and is where anything
with an entry point gets proved.

- **The frontend build is byte-identical to baseline `f23d11a`** and must stay that way until
  a ticket deliberately changes it. Current hashes are recorded in `docs/adr/PAS-0001-REPORT.md`.
  Verify with an md5 comparison, not by eye.
- **Completion contract:** every ticket closes with the machine-verifiable report (Clean-Sheet
  Part II). If any acceptance criterion fails: **STATUS = BLOCKED.** Never
  *COMPLETE WITH TODO*. Known Issues may not hide an unmet criterion.
- **`apps/web` SHALL NOT become a dependency of any domain package.** Re-verify whenever a
  workspace dependency is added.
- **No secrets committed.** `.env` is gitignored; `.env.example` carries placeholders only.

---

## 5. Standing rules earned from prior tickets

- **ADR-001** — a representation generator must enforce visibility no later than the phase in
  which non-public records enter the model. Transitional guard at PAS-0504; structural
  replacement at PAS-2801.
- **ADR-002 consumer sweep** — every build opens with one. Where the build changes the
  meaning, visibility, lifecycle or governance of data an existing component consumes, inspect
  *every* consumer and move the protection into *this* build. A later-phase consumer cannot
  remain unsafe because its nominal phase has not arrived.
- **ADR-004** — origin (AI, document, web, connector, manual entry, Gap Interview, admin)
  affects provenance and policy, never *whether governance exists*.

- **Test fixtures read the catalogue; they do not enumerate the schema.** Earned at PAS-0202,
  where one build broke five hard-coded schema facts at once: a drop list, two truncate lists,
  an exact-table-set assertion, and a migration count. Every one was correct when written and
  silently wrong the moment a migration landed, and each failed as a test failure that looks
  like a product failure.

  So: drop with `drop schema public cascade`, truncate a set computed from `pg_tables`, assert
  **containment** of the tables a ticket is about rather than equality with the whole schema,
  and name a migration rather than counting them. A fixture that has to be edited by every
  future migration will not be.

- **A suite that migrates a shared database owns its starting state.** `pas_test` holds no
  durable state: `packages/database/tests/migrate.test.ts` destroys `schema_migrations`,
  because the ledger is its subject. Any suite assuming a consistent schema *and* ledger is
  assuming something no other suite is obliged to preserve — reset first, then migrate.
  Fixing this one suite at a time does not work; PAS-0201 fixed a symptom and PAS-0202 hit
  the same cause again.

  **And build fixtures per *test*, not per *file*.** Extended at PAS-0301, where the same
  cause bit a third time from the other direction: `database.test.ts` created its table in
  `beforeAll` and only truncated it afterwards, which assumes it survives the whole file. Its
  sibling resets the schema wholesale, and the drop can land at a process-teardown boundary
  that `fileParallelism: false` does not govern. The result was three tests failing at the
  tail of one file and passing on the next run.

  An **intermittent** failure in a shared fixture is worse than a consistent one: it reads as
  infrastructure flakiness and gets re-run until green. `create table if not exists` plus a
  truncate, per test, costs one cheap statement and removes the assumption instead of
  narrowing the window.

- **A test that takes schema apart puts it back by re-running the migration, never from a
  copy written in the test.** Earned at PAS-0303. A test dropped a constraint, exercised the
  gap, and restored the constraint in `finally` from a hardcoded duplicate of the migration's
  text. It passed, and it silently repaired the schema before the next test looked — so a
  mutation that *loosened that constraint in the migration* survived the sweep. The fixture
  was testing its own copy.

  Restore with `drop schema public cascade` → `create schema public` → `migrate(...)`. This is
  the catalogue-over-enumeration rule applied to constraints: a fixture that re-declares
  schema is a fixture that hides schema defects.

- **A timeout cannot fail a synchronous hang.** Earned at PAS-0303, on the first attempt to
  test a scan that goes exponential on shared references. The test asserted elapsed time under
  a vitest `{ timeout }`, and the timeout never fired: the recursion never yields the event
  loop, so no timer can interrupt it. The defect became a *hung CI job* rather than a failing
  one — strictly worse than not testing it, because a hang reads as infrastructure trouble and
  gets re-run.

  Assert **work done**, not time elapsed. A counting getter that throws past a bound, a visit
  counter, an instrumented call — something the mutant trips on its own thread. The replacement
  fails in 10 ms with a message naming the defect.

---

## 6. Open — and what "open" actually means

Re-triaged 2026-09-22, at the owner's direction. Two of the three items below were never
owner decisions; they were unfinished technical work parked in a table that made them look
like someone else's problem. Technical calls are implementation's to make and state.

**Owner's, genuinely:**

| Item | Why it is not implementation's | Blocks |
|---|---|---|
| Fixture **P2** (deep academic) and **P3** (skilled practitioner) subjects | Whose real professional life PAS models. A synthetic subject defeats the fixture's purpose, and a real one cannot be invented. | Build 22, Build 37 |

Implementation's contribution: define the *shape* each fixture must satisfy, so naming a
subject is the only remaining step. Offered alternative — build P2/P3 from public-record
subjects, which needs only a yes.

**Decided by implementation; owner may override:**

| Item | Decision | Recorded |
|---|---|---|
| Verification requirement content per credential class | The requirements are **data, not architecture**. A registry holds them per credential class, seeded with a default tier ladder (self-asserted → source-confirmed → independently-verified, per INV-12) and editable without a deployment. Domain expertise populates rows; it does not block the build. | ADR at PAS-1002 |
| Source artifact retention/deletion policy | Retain indefinitely; deletion tombstones rather than erases, because a deleted source retroactively invalidates every claim that cited it (INV-12). Hard erasure is a separate, audited, rare path for statutory requests. The only genuinely external input is a retention *period* per jurisdiction — a number, added later, blocking nothing. | ADR at PAS-0604 |
| `user_capability_overrides` vs `capability_overrides` | `capability_overrides`, grained to membership. The platform is an account. | **ADR-007** |

Fixture **O1** (organization) is **not** blocked — source material is in `EXAMPLES/`.

**Settled (ADR-006):** `contracts`, `config`, `observability`, `database` and `domain` may be
depended upon by any package without a proposal. Every other edge is still proposed and held.

**Settled (ADR-005):** `@pas/contracts` may be depended upon by any package. It is the
universal sink; an edge to it can never create a cycle. This does **not** extend to any other
package — every other new workspace edge is still proposed and held.

---

## 7. Known live defects carried forward

**SUP-13 — `GATED` material renders on a public surface.**
`auth-anthem-loi` (`visibility: 'GATED'`, `M04`) appears on dossier `d03`
(`CORE_PUBLIC`, uses `M04`) because `apps/web/src/components/public/PublishedPersonalPAS.tsx:267`
resolves membership with no visibility predicate. Four unguarded consumers; see
`docs/RECONCILIATION.md` Part 14. Resolution is PAS-0504. **Do not fix it early** — it is
tracked, and the guard belongs with the visibility architecture.

**CONF-A — five sites create publish-ready public authority with no governance.**
Services, store and UI. They must route through *one* governed write path at Build 11, not be
patched individually. See `docs/RECONCILIATION.md`.
