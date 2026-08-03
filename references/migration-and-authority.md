# Migration and authority

Use this reference only for repository-wide reorganization or authority conflicts.

## Classify facts before files

Map each changing fact to one owner before moving documents:

| Fact                                        | Preferred authority                     |
| ------------------------------------------- | --------------------------------------- |
| Product scope and exclusions                | accepted product baseline or PRD        |
| Accepted decisions and unresolved conflicts | decision/risk register or ADR set       |
| Current progress and blockers               | one short status document               |
| Open tasks and acceptance IDs               | active delivery plan or issue tracker   |
| HTTP API                                    | OpenAPI or equivalent contract          |
| Events                                      | versioned event schema                  |
| Database structure                          | schema, forward migrations, constraints |
| Runtime relationships                       | generated code/dependency graph         |
| Historical execution evidence               | dated archive                           |

Documents may explain an authority but must not duplicate volatile fields, statuses, or inventories.

## Migration sequence

1. Inventory existing Markdown, links, status markers, and references from repository instructions.
2. Mark each document `retain`, `merge`, `move`, `archive`, `generate`, or `review`.
3. Establish destination directories before moving content.
4. Move unchanged historical evidence first.
5. Create compact routing documents and domain entries.
6. Move active designs, then update every link in one change.
7. Generate indexes after paths stabilize.
8. Validate and only then remove empty legacy directories.

## Safety rules

- Preserve unrelated user edits and dirty-worktree content.
- Do not silently resolve product conflicts during documentation cleanup.
- Do not convert a historical claim into a current acceptance result.
- Do not rewrite accepted ADR conclusions. Supersede them with a new decision.
- Keep source requirements read-only unless the user is explicitly changing the baseline.
- Treat Git history as diff history, not as the only archive: retain human-readable evidence needed for audits.

## Token-efficient retrieval

Repository growth legitimately increases context for broad changes. Optimize by relevance rather than fixed budgets:

- search headings, IDs, symbols, and paths before reading full files;
- start from one domain and expand with the actual dependency surface;
- keep routing pages compact and stable;
- query generated indexes instead of loading them wholesale;
- read source and archive material only for provenance, conflict, audit, or regression analysis.
