# `references/` — status

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
