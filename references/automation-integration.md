# Automation integration

Use this reference when installing persistent scripts, CI checks, hooks, or a code graph.

## Runtime assets

Copy and adapt these files into the target repository with `apply_patch`:

| Skill asset                                    | Suggested target                      |
| ---------------------------------------------- | ------------------------------------- |
| `assets/runtime/docs-toolkit.mjs`              | `scripts/docs-toolkit.mjs`            |
| `assets/runtime/document-index.mjs`            | `scripts/document-index.mjs`          |
| `assets/runtime/check-doc-governance.mjs`      | `scripts/check-doc-governance.mjs`    |
| `assets/runtime/check-markdown-links.mjs`      | `scripts/check-markdown-links.mjs`    |
| `assets/templates/docs-governance.config.json` | `scripts/docs-governance.config.json` |
| `assets/templates/docs-governance.schema.json` | `scripts/docs-governance.schema.json` |

Copy the four runtime files as a unit because the three CLIs import `docs-toolkit.mjs`. The link checker validates local files plus GitHub-style heading anchors and explicit HTML `id` or `name` anchors; adapt it if the target renderer uses different slug rules. Copy templates only when the repository lacks an equivalent authority. Replace placeholders and preserve existing decisions.

## Package commands

For Node package scripts, prefer these names:

```json
{
  "scripts": {
    "docs:index:generate": "node scripts/document-index.mjs generate",
    "docs:index:check": "node scripts/document-index.mjs check",
    "docs:index:query": "node scripts/document-index.mjs query",
    "docs:index:watch": "node scripts/document-index.mjs watch",
    "docs:governance:check": "node scripts/check-doc-governance.mjs",
    "docs:links:check": "node scripts/check-markdown-links.mjs"
  }
}
```

Adapt command syntax for non-Node projects while keeping generated outputs deterministic.
The generated index uses direct `node scripts/document-index.mjs` examples so it remains independent of the target package manager.

## CI and hooks

CI order:

1. Generate or check any stack-specific code graph.
2. Check the document index.
3. Check governance metadata and archive boundaries.
4. Check links and formatting.
5. Run normal project validation.

A pre-commit hook may generate derived files, then fail if they are unstaged or untracked. Check both cases: ordinary `git diff` does not detect untracked generated files.

Do not replace an existing hook wholesale. Merge commands and preserve its security or generated-contract checks.

## Code graph adaptation

Build a code graph only from detectable facts:

- package or workspace manifests and runtime dependency declarations;
- language imports;
- route or controller declarations compared with API contracts;
- database models and migrations;
- event schemas;
- UI route or page manifests;
- project-specific forbidden dependency rules.

Keep stack adapters separate from domain configuration. Report static limitations such as reflection, dependency injection, dynamic imports, code generation, or runtime plugins.

Expose the same four operations as the document index:

- `generate`: write deterministic machine JSON plus compact human navigation;
- `check`: fail when committed graph output is stale;
- `query`: return a bounded subgraph for a path, symbol, domain, route, table, or event;
- `watch`: refresh after relevant local source or manifest changes.

Treat watch mode as developer feedback, not the correctness boundary. Pre-commit generation and CI `check` keep the shared repository current when no watcher is running. Store evidence on every edge—source path and, when stable, symbol or line—so AI can expand context from a small subgraph instead of reading the whole graph.

Keep graph adapters highly cohesive and loosely coupled: one parser per language or contract family, one normalized graph schema, and no adapter importing another adapter. If the target stack lacks a trustworthy parser, generate only package, contract, schema, and manifest relationships rather than guessing symbol edges.

Suggested command names:

```json
{
  "scripts": {
    "codegraph:generate": "<project-specific generator>",
    "codegraph:check": "<project-specific freshness check>",
    "codegraph:query": "<project-specific bounded query>",
    "codegraph:watch": "<project-specific watcher>"
  }
}
```

## Validation

Generate twice and compare hashes. Query at least one path or domain, stable ID, and body keyword. Verify links from generated Markdown. Start watch mode when the environment permits a persistent process; otherwise report that it was not observed.

The runtime supports maintained Node.js LTS releases. Test on both Windows and Linux when changing path handling, file watching, Markdown parsing, or atomic output behavior.
