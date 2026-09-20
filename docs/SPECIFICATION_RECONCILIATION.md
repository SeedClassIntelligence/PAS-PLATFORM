# Specification Reconciliation

**Between:**
- `docs/PAS_MASTER_SPECIFICATION.md` — PAS Master Architecture & Build Specification **v1.0** (received first)
- `docs/PAS_CLEAN_SHEET_BUILD_SPECIFICATION.md` — PAS **Clean-Sheet** Master Build Specification, Parts I & II (received second)

**Status:** ⚠️ **One unresolved fork. Owner decision required.**
**Prepared:** Phase 0. No application source modified. No plan rewritten pending the decision.

---

## Summary

The two specifications **agree on every canonical invariant** — there is not one architectural
contradiction between them. The Clean-Sheet document is the construction-level decomposition
of the same architecture: 38 builds, ~177 tickets, exact tables, exact endpoints, exact
dependency ordering.

They diverge on **three structural questions** and one of those is genuinely load-bearing:

| | v1.0 | Clean-Sheet | Severity |
|---|---|---|---|
| **Posture toward the existing prototype** | migrate underneath it, preserve it | "clean-sheet"; Build 35 implements the workspaces | 🔴 **FORK — owner decision** |
| Repository topology | modular monolith, paths unspecified | `apps/*` + 17 `packages/*` monorepo | 🟡 reconcilable |
| Work decomposition | Phases 0–11 | Builds 00–37, tickets PAS-0001…PAS-3608 | 🟡 Clean-Sheet is strictly more precise |

The Clean-Sheet spec also **independently confirms ADR-001** and **resolves open flag DISC-2**.

---

# Part 1 — Where they agree (no action required)

Every invariant in v1.0 §LX appears in the Clean-Sheet spec, usually verbatim. The
correspondence is exact enough that these read as one architecture described at two
altitudes.

| Invariant | v1.0 | Clean-Sheet |
|---|---|---|
| Source → Observation → Claim → Evidence lineage | §VII | Part I §0.12, §12–14 |
| Extraction may propose, never establish | §VIII | Part II PAS-1703; Part I §29 |
| **Extractor may not self-assert `VERIFIED` / `PUBLISH_READY`** | §VIII | Part I §29 — *near-identical wording* |
| Five provenance states, exact meanings | §IX | Part I §15; PAS-1001 |
| Governance lifecycle `DRAFT→EXTRACTED→…` | §X | Part I §2; PAS-0804 |
| Governance decisions `ALLOW`/`DENY`/`REQUIRE_REVIEW`/`REQUIRE_CONFIRMATION`/`ESCALATE` | §XXXVII | PAS-1102 |
| No universal module/dossier/page count | §XIII, §XV, §XVII | Part I §0.16 |
| **Dossier → Authority; no `associatedDossierIds`** | §XVI | Part I §39; PAS-2403 — *names the field* |
| No unexplained alignment percentage | §XXVII | Part I §51 — *"No unsupported 94% alignment mechanism"* |
| Agent Gateway; agents return proposals | §XXXV | Part I §28; PAS-1601 |
| Event ledger + transactional outbox | §XXXIII, §XXXIV | Part I §21–22; PAS-0303/0304 |
| Durable non-semantic IDs, no `M01`/`d01` | §XLI | Part I §3; PAS-0103 |
| Vector/search/graph indexes are derived | INV-22 | Part I §0.10, §59; PAS-3403 |
| Dependency + impact analysis | §XXXIX | Part I §57–58; PAS-3301/3302 |
| `NO_SUPPORTED_AUTHORITY` must be expressible | §XXIV, INV-16 | PAS-2905; Part I §66 |
| Personal PAS and BPAS distinct | §IV, INV-18 | Part I §0.15, §46 |
| Learning proposes, never rewrites | §XXXII | Part I §56; PAS-3205 |
| Outcome separate from attribution | §XXXI | Part I §55; PAS-3203 |
| Visibility enforced server-side | §XXII | Part I §0.17; PAS-0504 |

**Conclusion: zero invariant conflicts.** Whatever is decided about topology and posture,
`ARCHITECTURE_DECISIONS.md` Part A (the 30 invariants) stands unchanged and is confirmed by
both documents.

---

# Part 2 — 🔴 The fork: clean-sheet build, or migration?

**This is the decision. Everything else follows from it.**

### What v1.0 says

- §XLIX — *"Do not rebuild the visual experience simply because the backend changes."*
- §L — *"Do not collapse BPAS into Personal PAS."*
- §LIV — *"Do not conduct a wholesale UI rewrite during backend migration."*
- §LVII — `Expand → Migrate → Verify → Contract`; *"Do not delete prototype fields before replacement functionality exists."*
- §LVIII — *"Existing usable screens must continue rendering… This allows us to build **underneath** PAS rather than destroy it while 'modernizing.'"*

v1.0 is unambiguously a **migration specification**. The 20 existing components are the
baseline to preserve.

### What the Clean-Sheet spec says

- The title: **"Clean-Sheet"** Master Build Specification.
- PAS-0001 — *"Establish the **permanent** repository structure for the complete PAS platform"* — implying the current structure is not it.
- Build 35 (PAS-3501…3508) — *"Implement complete operational UI over real backend services"* across eight workspaces.
- Part I §60 defines a top-level IA — Authority Workspace · Representation Studio · Publishing Center · Discovery Center · Fellowship · Relationships & Opportunities · BPAS Workspace · Administration — which **does not map one-to-one** onto the existing route set (`overview`, `builder`, `modules`, `dossiers`, `graph`, `pagebuilder`, `publishing`, `domains`, `connections`, `bpas`, `fellowship`, `marketplace`, `tools`, `verify`, `seo`, `settings`, `admin`).
- Part I §0.26 — *"Do not substitute mocks for required production capabilities when a build is declared complete."*
- Part I §69 — *"A coding assistant may not mark a build complete because the screen renders… or mock data appears correctly."*

### Why this is not resolvable by reading

The Clean-Sheet spec contains **no supersession clause**. v1.0 carried one explicitly
(*"supersedes the fragmented architectural proposals… only where they conflict"*); this
document does not say whether it supersedes v1.0, sits beneath it, or replaces the migration
posture.

Textual evidence points both ways:

| Reads as *replacement* | Reads as *decomposition* |
|---|---|
| Titled "Clean-Sheet" | Part II closing: *"The next decomposition is **mechanical rather than architectural**"* |
| "permanent repository structure" | Every invariant matches v1.0 exactly |
| Build 35 implements all workspaces | No supersession clause, where v1.0 had one |
| §60 IA differs from existing routes | Does not revoke v1.0 §LXI's handoff artifacts |

### What each answer costs

**If CLEAN-SHEET replaces the migration posture:**
- `RECONCILIATION.md`'s PRESERVE classifications become *"reference implementation, port later"* rather than *"preserve in place."*
- `IMPLEMENTATION_PLAN.md` (Phases 0–11) is superseded wholesale by Builds 00–37.
- The 20 components become a visual and behavioral reference, not the baseline.
- §LVIII non-regression no longer governs the frontend — there is nothing to regress against.
- **Cost:** the working product experience is rebuilt. **Gain:** no migration debt; the §60 IA is built correctly once.

**If CLEAN-SHEET is the decomposition of the same architecture, executed as migration:**
- Builds 00–37 supersede Phases 0–11 as the work breakdown (strictly better — they are more precise).
- The existing `src/` moves intact to `apps/web/` and is progressively re-pointed at real services.
- §LVII and §LVIII continue to govern the frontend.
- Build 35 becomes *"re-point the existing workspaces at real services"* rather than *"write them."*
- **Cost:** the §60 IA arrives incrementally rather than cleanly. **Gain:** the working product is never dark.

### Recommendation

**Clean-sheet topology and decomposition; migration discipline for the frontend.**

Concretely:

1. **Adopt PAS-0001's monorepo topology in full.** It satisfies v1.0 §XLIII — `packages/*`
   inside one deployable *is* a modular monolith — and it is materially better organized
   than the `api/` + `worker/` layout I proposed. My `IMPLEMENTATION_PLAN.md` target tree is
   superseded by it.
2. **Move existing `src/` → `apps/web/src/` as a pure `git mv`.** Zero code change, the
   baseline is preserved, and the tree conforms to PAS-0001 immediately.
3. **Adopt Builds 00–37 as the controlling work breakdown.** Phases 0–11 were my
   interpolation of §LVI; the ticket sequence is the real thing and supersedes them.
4. **Keep §LVII/§LVIII for the frontend only.** Build the entire backend clean-sheet from
   Build 00 — there is nothing there to preserve. Let Build 35 re-point the existing 20
   components rather than rewrite them, and let the §60 IA emerge as surfaces become real.

This reconciles both documents at full strength: the backend is built properly from nothing,
and the one genuinely valuable asset in the repository — a working, building, coherent
product experience — is not discarded to get there.

**The one case where I am wrong:** if you want the §60 IA built fresh because the existing
route structure encodes prototype assumptions you no longer want (M01–M08 module navigation,
the 10-dossier manager, fixed page builder). That is a **product** judgment about the UI, not
an architectural one, and it is yours. Say so and the 20 components become reference.

---

# Part 3 — 🟡 Repository topology

**Reconcilable. No decision needed beyond the fork above.**

The Clean-Sheet topology (Part I §1 / PAS-0001) is authoritative and replaces the target tree
in `IMPLEMENTATION_PLAN.md`:

```
pas-platform/
├── apps/{web,api,worker}/{src,tests}
├── packages/{domain,database,contracts,auth,governance,workflows,events,
│             agent-gateway,ingestion,authority-intelligence,composition,
│             publishing,discovery,fellowship,observability,ui,config}
├── migrations/  fixtures/
├── tests/{integration,contract,e2e,security}
├── docs/{architecture,adr,api,workflows,operations}
└── infrastructure/
```

Two consequences for existing Phase 0 artifacts:

1. **`src/` has no home in this tree except `apps/web/src/`.** Under the recommendation
   above this is a `git mv` with no code change.
2. **`docs/adr/` is a directory in this topology.** The current
   `ARCHITECTURE_DECISIONS.md` is a single file. It should be split into numbered ADR files
   under `docs/adr/` (ADR-001, ADR-002 already exist by number), with the invariants moving
   to `docs/architecture/`. Mechanical, not architectural — deferred until the fork is
   decided so it is done once.

Dependency direction is also now explicitly specified (PAS-0001) and was not in v1.0:

```
web → contracts/ui          domain → contracts
api → domain/contracts/auth governance → domain/contracts
worker → domain/workflows/events   …
```

with the hard rule: **`web` SHALL NOT become a dependency of domain packages.** Recorded.

---

# Part 4 — 🟡 Work decomposition

`IMPLEMENTATION_PLAN.md` Phases 0–11 were derived from v1.0 §LVI. The Clean-Sheet spec
supplies Builds 00–37 with ticket-level granularity and an explicit dependency chain (Part I
§70, Part II master execution sequence).

**Builds 00–37 supersede Phases 0–11.** They are not in conflict — they are the same ordering
at finer resolution — but several placements differ and the ticket sequence wins:

| Work | My Phase | Clean-Sheet Build |
|---|---|---|
| Authority Graph persistence | Phase 2 | Build 15 (after Experience at 14) |
| Agent Gateway | Phase 4 | Build 16 |
| Real ingestion | Phase 4 | Build 17 |
| Knowledge / Know-How / Expertise | Phase 5 (together) | Builds 19 / 20 / 21 (separate) |
| Composition | Phase 6 | Build 23 |
| Publication | Phase 7 | Build 27 |

`IMPLEMENTATION_PLAN.md` is therefore marked **provisionally superseded** rather than
rewritten — rewriting it before the fork is decided would produce a document that is wrong
under one of the two answers.

---

# Part 5 — ✅ ADR-001 independently confirmed, and moved earlier

The Clean-Sheet spec states ADR-001 independently, in its own words, and places it **earlier
than Phase 2**:

> **PAS-0504 — Private Record Boundary.** *"Implement visibility architecture **before**
> adding substantive private records."* … *"Visibility is not merely a frontend display
> preference. Repository/service query paths must enforce access."*

This lands in **Build 05 (Authority Record)** — before Build 06 (Sources) and long before any
representation work. It is the same governing dependency ADR-001 recorded
(`Visibility enforcement → Private records → Machine representation`), reached independently.

Reinforced at three further points:

- **PAS-0505** — privacy regression test that *"remains permanently in the security suite."*
- **PAS-2804** — machine privacy test across HTML, public API, JSON-LD, sitemap, search index.
- **Part I §68** — mandatory security test; ***"Failure of this test blocks release."***
- **PAS-2801** — JSON-LD generated *exclusively* from `PublishedRepresentation`, never from
  the Authority Record. This is stronger than ADR-001: it makes the exposure structurally
  impossible rather than filtered.

**Action:** ADR-001 stands, upgraded. The guard moves from "Phase 2" to "Build 05, before
sources exist." SUP-13's finding (four unguarded consumers, live exposure at `f23d11a`)
remains accurate and is now covered structurally by PAS-2801/2703 rather than by adding
filters to the existing generators.

---

# Part 6 — ✅ DISC-2 resolved

`RECONCILIATION.md` Part 15 carried DISC-2 open: *is §VIII's four-site enumeration
exhaustive, and should a user-origin creation rule be stated alongside the extraction rule?*

**The Clean-Sheet spec answers it.** The governing rules are origin-agnostic:

- **Part I §0.22** — *"Require explicit governance for governed state transitions."*
- **PAS-1104** — *"**Every** governed state change stores the decision responsible for
  authorizing it."*
- **PAS-0204** — all protected server operations call the central authorization service.

No exemption exists for user-origin creation. `AuthorityGraphView.tsx:15-39` (CONF-A site 5,
SUP-12) is governed by the same rule as the four extraction sites, and the enumeration in
v1.0 §VIII is illustrative of a general rule rather than exhaustive.

**DISC-2 status: CLOSED.** All five CONF-A sites route through one governed write path, which
was already the planned resolution under either reading.

---

# Part 7 — New requirements not present in v1.0

Adopted. These are operating constraints on implementation, not architecture.

### Per-ticket completion contract (Part II, closing)

Every ticket must end with a machine-verifiable report:

Ticket ID · Status · Files Created · Files Modified · Database Migrations · Domain Contracts ·
API Contracts · Events · Workflow Changes · Governance Changes · Authorization Changes ·
Tests Added · Tests Passed · Typecheck Result · Build Result · Security/Privacy Impact ·
Backward Dependency Check · Forward Dependencies Unlocked · Known Issues

With the hard rule:

> *"Known Issues cannot be used to hide incomplete acceptance criteria. If acceptance criteria
> fail: **STATUS = BLOCKED**, not STATUS = COMPLETE WITH TODO."*

**Accepted.** Every ticket I execute will close with this report, and a failed acceptance
criterion will be reported as BLOCKED.

### Four fixtures, not three

v1.0 §LIX required three (A/B/C) and deferred organizational fixtures. Part I §62 requires
**four now**: P1 multidimensional operator · P2 deep academic · P3 skilled practitioner ·
**O1 organization**.

**This upgrades open item 2.** O1 is no longer deferred.

### Correlation and causation identity (PAS-0004)

Every request, workflow, worker operation, event and agent task carries `correlationId`;
caused operations carry `causationId`. Not present in v1.0. Recorded.

### Canonical timestamp discipline (PAS-0104)

`createdAt` · `updatedAt` · `occurredAt` · `validFrom` · `validTo` · `publishedAt` ·
`observedAt` — *"Do not overload `createdAt` to represent real-world occurrence."*
Not present in v1.0. Recorded.

### Same-transaction mutation + outbox (Part I §5)

A canonical mutation and its outbox event occur in **one transaction**. Explicitly forbids
update → commit → publish-later. Sharper than v1.0 §XXXIV. Recorded.

### Twelve certification scenarios (Build 37)

PAS is not complete until all twelve pass. This replaces §LV's eight-question Build Contract
as the *release* gate; §LV remains the *component* gate. Both apply.

---

# Part 8 — Open items, updated

| Item | Status |
|---|---|
| **FORK — clean-sheet vs. migration posture** | 🔴 **OPEN — blocks all further planning** |
| DISC-1 — service classification | ✅ Resolved (v1.0 §XLV controls) |
| DISC-2 — §VIII enumeration scope | ✅ **Resolved by Clean-Sheet Part I §0.22 / PAS-1104** |
| DISC-3 → ADR-001/002 | ✅ Confirmed, upgraded by PAS-0504/2801 |
| Open 1 — verification requirements | 🟡 **Partly answered.** PAS-1002 supplies the table and the variance axes; the *content* per credential class remains an owner decision. |
| Open 2 — fixtures | 🟡 **Upgraded.** Four required (P1/P2/P3/O1), not three. Subjects still needed. |
| Open 3 — source retention policy | 🟡 Open. PAS-0604 and Part I §11 require a retention policy field; the policy itself is still an owner decision. |
| Open 4 — WDJIV M01–M08 visibility | 🟡 Open, and now partly dependent on the fork. |

---

## What has not been done, deliberately

- `IMPLEMENTATION_PLAN.md` has **not** been rewritten to Builds 00–37. It would be wrong
  under one of the two answers to the fork.
- `src/` has **not** been moved to `apps/web/`.
- The monorepo topology has **not** been created.
- `ARCHITECTURE_DECISIONS.md` has **not** been split into `docs/adr/`.
- **No application source has been modified.** The baseline remains byte-identical to
  `f23d11a`.

All four are mechanical and fast once the fork is decided. None should be done twice.
