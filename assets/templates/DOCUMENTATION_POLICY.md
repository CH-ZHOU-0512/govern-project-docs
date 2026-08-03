---
doc-id: DOC-DOCUMENTATION-POLICY
status: active
owner: engineering
last-reviewed: YYYY-MM-DD
authority-for:
  - repository.documentation-governance
---

# Documentation policy

## Authority

Define one authority for product scope, decisions, current status, open work, machine contracts, operations, and historical evidence. Authority identifies conflict resolution; it does not make a document mandatory reading for every task.

Every governed document has a stable `doc-id`. Documents with an `accepted` or `active` status may claim machine-readable authority keys through `authority-for`. One key may be held by only one accepted or active document.

## Progressive retrieval

Read in proportion to the change surface. Start from the task, direct code, one domain entry, and machine contracts. Search headings and stable IDs before reading long documents. Read source, reference, generated, and archive materials only when provenance, audit, conflict, or targeted navigation requires them.

## Lifecycle

Use `draft`, `accepted`, `active`, `superseded`, and `archived`. A superseded document must name its replacement. The replacement declares `supersedes`, and the old document declares the reciprocal `superseded-by`. Do not keep two active copies of the same changing fact.

Governance tooling reads top-level scalar fields and one-level scalar lists. Use block lists for `authority-for`, `supersedes`, and `superseded-by`. Nested YAML may carry additional project metadata but is not used for authority, routing, or lifecycle checks unless the tooling is extended deliberately.

Example replacement:

```yaml
# New document
doc-id: DOC-PAYMENTS-V2
status: active
authority-for: [payments.architecture]
supersedes: [DOC-PAYMENTS-V1]

# Old document
doc-id: DOC-PAYMENTS-V1
status: superseded
superseded-by: DOC-PAYMENTS-V2
```

## Generated material

Never hand-edit generated indexes or graphs. Generation must be deterministic and omit timestamps, random values, and machine-specific absolute paths.

## Completion

Update affected authority documents, generate derived files, check metadata, links, formatting, and project validation proportional to risk. Record what was not verified.
