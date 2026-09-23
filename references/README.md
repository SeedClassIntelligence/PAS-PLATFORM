# `references/` — status

> **The doctrine in this repository is the earlier version, and a fuller one exists elsewhere.**
> See *"Which doctrine is actually deployed here"* at the foot of this file. That gap sits
> behind the twelve below and is larger than any of them.

`CAS-doctrine.md` points at twelve files from this directory. **None of them have been
written.** This README exists so that absence is tracked rather than silent.

That distinction is the whole point. A doctrine that points at twelve files and finds zero on
disk teaches a reader — correctly — that its pointers are decorative, and that lesson does not
stay contained: it generalises to the pointers that *do* resolve. A pointer marked UNWRITTEN
keeps its authority. A pointer that silently resolves to nothing spends it.

These are the owner's documents. Implementation does not author them (CLAUDE.md §2, §LXI).

## Industries — `references/industries/`

| # | File | Covers | Status |
|---|------|--------|--------|
| 01 | `01-legal-compliance.md` | Litigation, regulatory compliance, contract/procedural work | **UNWRITTEN** |
| 02 | `02-technical-systems.md` | Software architecture, infrastructure, engineering execution | **UNWRITTEN** — relevant to this mission |
| 03 | `03-financial-revenue.md` | Payment architecture, settlement logic, fee/custody design | **UNWRITTEN** |
| 04 | `04-healthcare.md` | Clinical-adjacent, patient-facing, health information work | **UNWRITTEN** |
| 05 | `05-real-estate-construction.md` | Property, development, construction, contracts | **UNWRITTEN** |
| 06 | `06-nonprofit-government-grants.md` | Nonprofit ops, grant applications, government-funded programs | **UNWRITTEN** |
| 07 | `07-creative-media-entertainment.md` | Content platforms, creator economics, media/entertainment | **UNWRITTEN** |
| 08 | `08-retail-ecommerce.md` | Retail operations, e-commerce, inventory/fulfillment | **UNWRITTEN** |
| 09 | `09-manufacturing-supply-chain.md` | Production, logistics, supply-chain | **UNWRITTEN** |
| 10 | `10-education-workforce.md` | Educational program design, curriculum, workforce training | **UNWRITTEN** |

## Special operating contexts — `references/special-contexts/`

| File | Covers | Status |
|------|--------|--------|
| `SWARM-corporate-coordination.md` | Multiple CAS agents on a shared mission | **UNWRITTEN** |
| `CODING-autonomous-agent.md` | Code written, deployed or executed with reduced human review | **UNWRITTEN — this is the mission's file** |

## On `CODING-autonomous-agent.md`

The doctrine describes it as *"the hardest-line file in the doctrine, since mistakes here get
executed, not just reported."* That is an exact description of this repository, and it is the
one file whose absence has cost something measurable.

In its place, `CLAUDE.md` §4 (Non-negotiables) and §5 (Standing rules earned from prior
tickets) have been doing that job. §5 in particular is already written in the form that
survives a working context: a specific failure, the specific fix, and what it cost. Every rule
in it was earned by a defect that shipped.

Implementation's recommendation, for the owner to ratify or override: rather than write this
file from scratch, promote `CLAUDE.md` §5 into it and let §5 continue as the intake — rules are
earned at a ticket, then lifted here once they generalise beyond this repository. That keeps
the hardest-line file grounded in failures that actually happened rather than ones imagined in
advance.

---

## Which doctrine is actually deployed here

`CAS-doctrine.md` (and its byte-identical twin `SKILL.md`) is the **earlier** CAS doctrine: the
SKILL-format, conditionally-triggered version. A later doctrine — `cas-agent.md`, converted into
a standing identity rather than a triggered skill — was developed afterwards and **is not in this
repository**.

This was found on 2026-09-23, after `CAS-OPERATIVE-RULES.md` had its reference repointed from
`cas-agent.md` to `CAS-doctrine.md` on the assumption they were two names for one file. The
pointer resolved. It resolved to the wrong document.

Evidence, checked rather than assumed:

| Check | Result |
|---|---|
| Mutual Contract, Mission Roadmap, Presence, failure definition, cross-domain list | **all absent** from `CAS-doctrine.md` |
| Frontmatter | SKILL-format, `Use this skill whenever…` — conditionally triggered, the earlier signature |
| `cas-agent.md` on this filesystem | nowhere |
| `cas-agent.md` in this repository's git history | never committed |
| Last modification to `CAS-doctrine.md` | `f23d11a`, the baseline-extraction commit — **unchanged since the repository was created** |

That last row is the substantive finding. Everything developed after the baseline extraction
never reached this repository, so every session here has been governed by the earlier doctrine
while a more developed one existed.

**Owner's to resolve.** Implementation cannot reconstruct a document it has never seen, and
writing a plausible substitute would be worse than the gap — it would look like the real thing.
The options, for the owner to pick:

1. Supply `cas-agent.md`; it replaces or supersedes `CAS-doctrine.md` here, and
   `CAS-OPERATIVE-RULES.md` repoints to it.
2. Confirm the earlier doctrine is what should govern this repository, in which case this
   section stays as the record of why that is deliberate rather than accidental.

Until one of those happens, nothing in this repository should describe its doctrine as current.
