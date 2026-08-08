# Changelog

All notable changes to this project are documented in this file. The project follows [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-08-09

### Added

- A zero-dependency `govern-project-docs` CLI with `init`, `audit`, `check`, `index`, `governance`, and `links` commands.
- Atomic, idempotent repository initialization with dry-run support and explicit conflict protection.
- Authority Engine schema v2 with stable document IDs, narrow authority claims, reciprocal supersession edges, and cycle detection.
- Machine-readable authority and supersession fields in generated indexes and audit reports.
- Automated GitHub Release packaging for version tags.

### Compatibility

- Schema v1 configurations remain supported for incremental migration.
- The existing direct `node scripts/*.mjs` workflow remains supported.
- The package requires Node.js 22 or newer and has no runtime dependencies.

### Validation

- CLI installation, conflict handling, checks, queries, audits, and npm package contents are covered by cross-platform tests.
- GitHub Actions validates Node.js 22 and 24 on Ubuntu and Windows.

[0.2.0]: https://github.com/CH-ZHOU-0512/govern-project-docs/releases/tag/v0.2.0
