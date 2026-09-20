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
npm run verify      # typecheck → lint → test → build. Must pass at every ticket.
```

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

---

## 6. Open — owner decisions, not implementation's to make

| Item | Blocks |
|---|---|
| Verification requirement content per credential class | Build 10 (PAS-1002), `VerificationView` |
| Source artifact retention/deletion policy | Build 06 (PAS-0604), Build 17 |
| Fixture **P2** (deep academic) and **P3** (skilled practitioner) subjects | Build 22, Build 37 |

Fixture **O1** (organization) is **not** blocked — source material is in `EXAMPLES/`.

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
