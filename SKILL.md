---
name: govern-project-docs
description: Audit, reorganize, archive, and automate repository documentation for large or AI-iterated codebases. Use when users ask to organize docs, reduce duplicated or conflicting project knowledge, establish documentation taxonomy and authority, constrain AI context reading, create change archives, generate searchable document indexes, add documentation CI/hooks, or design an adaptable code graph.
---

# Govern project docs

Build a documentation system that stays authoritative, searchable, and economical to read as the repository grows. Preserve project-specific product and engineering truth; this Skill governs how knowledge is organized and retrieved, not what the product should do.

## Workflow

### 1. Establish the task boundary

- Read repository instructions and inspect the worktree before changing files.
- Use progressive disclosure: start from the user's request, directly affected files, and one likely domain. Expand only when the change surface requires it.
- Never impose a fixed Token target. Optimize retrieval without skipping relevant safety, contract, migration, privacy, or acceptance context.
- Do not create a goal, commit, push, or publish unless the user authorizes it.

### 2. Audit before redesigning

Run the read-only audit:

```powershell
node <skill-dir>/scripts/audit-docs.mjs --repo <repository-root>
```

Use the report to identify:

- active, source, reference, generated, and historical documents;
- duplicate overview, status, and design files;
- long routing documents and missing metadata;
- broken local links and stale path references;
- completed plans, handoffs, and acceptance records that belong in archives;
- machine facts already owned by OpenAPI, schemas, migrations, manifests, or code.

When moving an existing documentation tree, read [migration-and-authority.md](references/migration-and-authority.md). Do not read it for a small local documentation edit.

### 3. Design authority and taxonomy

Create the smallest useful hierarchy. Prefer these roles, renaming only when the project already has strong conventions:

```text
docs/
├─ governance/    # cross-project rules, decisions, risks, security
├─ product/       # product scope and user-facing reference
├─ architecture/  # cross-domain architecture and rationale
├─ domains/       # one compact entry per business capability
├─ delivery/      # current status, open work, active acceptance
├─ operations/    # deploy, operate, recover, roll back
├─ generated/     # derived indexes and graphs; never hand-edit
├─ source/        # versioned source requirements
├─ reference/     # auxiliary evidence and prototypes
└─ archive/       # completed or superseded records
```

Define one authority per changing fact. Authority does not mean every task must read the whole document. When schema v2 automation is installed, give every governed document a stable `doc-id` and express canonical facts as narrow `authority-for` keys. Resolve duplicate claims with the user; never choose a winner from filenames or timestamps alone.

Use three retrieval levels:

- `routing`: compact indexes and domain entry points;
- `on-demand`: current designs, decisions, plans, and runbooks;
- `source`, `historical`, and `derived`: only for provenance, audit, or targeted navigation.

### 4. Apply changes conservatively

- Preserve content when moving it; archive instead of deleting evidence.
- Never leave two active copies claiming authority.
- Update all local links and repository instructions in the same change.
- Keep current status short. Move completed work to dated archives.
- Keep API, event, database, and dependency facts in machine contracts. Documentation should explain invariants, rationale, ownership, and exceptions.
- Add an AI change archive only for cross-domain, contract, data, security, infrastructure, complex defect, or major refactor work. Do not create per-session logs.
- Record actual verification and unverified items separately.

### 5. Install automation only when useful

For a repository-wide governance setup, read [automation-integration.md](references/automation-integration.md), then adapt the assets rather than copying blindly.

Reusable assets:

- `assets/runtime/docs-toolkit.mjs`: shared deterministic path, CLI, metadata, link, configuration, and atomic-write utilities required by the runtime CLIs.
- `assets/runtime/document-index.mjs`: deterministic Markdown and JSON index with document IDs, authority claims, supersession edges, heading and stable-ID search, check, and watch modes.
- `assets/runtime/check-doc-governance.mjs`: document-ID, unique-authority, reciprocal-supersession, lifecycle, archive-boundary, and generated-banner checks driven by config.
- `assets/runtime/check-markdown-links.mjs`: local Markdown target validation.
- `assets/templates/`: governance policy, AI policy, change archive, configuration, and JSON Schema starters.

Install with `apply_patch`, preserve existing package scripts and hooks, and adapt commands to the project's package manager and CI. Do not overwrite existing policies or generated directories without reviewing their semantics.

Code graphs are stack-specific. Detect languages, package or workspace manifests, API contracts, data schemas, event schemas, UI manifests, and layer rules first. Generate only relationships supported by those facts; never infer runtime reflection as a static certainty. Provide bounded `query`, local `watch`, deterministic `generate`, and CI freshness `check`; "real-time" means fast local refresh plus enforced shared-state freshness, not an always-running process requirement.

This Skill does not ship a universal code-graph generator. Build or adapt one only after inspecting the target stack and its trustworthy machine contracts.

### 6. Validate

At minimum:

1. Generate derived files twice and compare hashes for determinism.
2. Query by a domain or path, a stable decision or task ID, and a body keyword.
3. Check local links, governance rules, formatting, and whitespace.
4. Confirm generated files are protected from hand editing and stale commits.
5. Run tests proportional to changed runtime or tooling risk. Documentation-only moves do not require unrelated database or external-service tests.
6. Report any watch mode, CI, device, provider, or production behavior not actually observed.

### 7. Deliver

Summarize:

- the authority map and taxonomy;
- documents moved, merged, archived, or deliberately retained;
- automatic index and code graph coverage;
- checks executed and exact results;
- remaining external or manual verification;
- whether changes are unstaged, committed, or pushed.

Avoid claiming that cleaner documentation resolves open product, compliance, provider, or release decisions.
