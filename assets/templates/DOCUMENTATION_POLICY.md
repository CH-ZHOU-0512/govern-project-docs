---
status: active
owner: engineering
last-reviewed: YYYY-MM-DD
---

# Documentation policy

## Authority

Define one authority for product scope, decisions, current status, open work, machine contracts, operations, and historical evidence. Authority identifies conflict resolution; it does not make a document mandatory reading for every task.

## Progressive retrieval

Read in proportion to the change surface. Start from the task, direct code, one domain entry, and machine contracts. Search headings and stable IDs before reading long documents. Read source, reference, generated, and archive materials only when provenance, audit, conflict, or targeted navigation requires them.

## Lifecycle

Use `draft`, `accepted`, `active`, `superseded`, and `archived`. A superseded document must name its replacement. Do not keep two active copies of the same changing fact.

Governance tooling reads top-level scalar front-matter fields such as `status`, `owner`, and `last-reviewed`; quoted scalar values are supported. Structured YAML may carry additional project metadata but is not used for routing or lifecycle checks unless the tooling is extended deliberately.

## Generated material

Never hand-edit generated indexes or graphs. Generation must be deterministic and omit timestamps, random values, and machine-specific absolute paths.

## Completion

Update affected authority documents, generate derived files, check metadata, links, formatting, and project validation proportional to risk. Record what was not verified.
