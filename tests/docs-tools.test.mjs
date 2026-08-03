import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  countLines,
  classifyMarkdownTarget,
  extractMarkdownLinks,
  markdownAnchors,
  parseFrontMatter,
} from "../assets/runtime/docs-toolkit.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const auditScript = join(repositoryRoot, "scripts", "audit-docs.mjs");
const governanceScript = join(
  repositoryRoot,
  "assets",
  "runtime",
  "check-doc-governance.mjs",
);
const indexScript = join(
  repositoryRoot,
  "assets",
  "runtime",
  "document-index.mjs",
);
const linksScript = join(
  repositoryRoot,
  "assets",
  "runtime",
  "check-markdown-links.mjs",
);

function createRepository(t, overrides = {}) {
  const path = mkdtempSync(join(tmpdir(), "govern-project-docs-"));
  t.after(() => rmSync(path, { force: true, recursive: true }));
  const config = {
    $schema: "./docs-governance.schema.json",
    schemaVersion: 1,
    docsRoot: "docs",
    generatedRoot: "docs/generated",
    activeDirectories: [
      "architecture",
      "delivery",
      "domains",
      "governance",
      "operations",
      "product",
    ],
    excludedFromMetadata: ["archive", "generated", "reference", "source"],
    requiredMetadata: ["status", "owner", "last-reviewed"],
    allowedStatuses: ["draft", "accepted", "active", "superseded", "archived"],
    lineLimits: { default: 500, "README.md": 300 },
    routingPaths: ["docs/README.md"],
    routingPatterns: ["^docs/domains/(?:[^/]+/)?README\\.md$"],
    stableIdPrefixes: ["ADR", "TASK", "DOC"],
    ...overrides,
  };
  write(path, "scripts/docs-governance.config.json", `${JSON.stringify(config, null, 2)}\n`);
  return path;
}

function write(root, path, content) {
  const absolutePath = join(root, path);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, content, "utf8");
}

function activeDocument(title, body = "") {
  return `---\nstatus: active\nowner: engineering\nlast-reviewed: 2026-08-03\n---\n\n# ${title}\n\n${body}\n`;
}

function run(script, args, cwd = repositoryRoot) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: "utf8",
  });
}

async function waitFor(predicate, description, timeoutMilliseconds = 5_000) {
  const deadline = Date.now() + timeoutMilliseconds;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error(`Timed out waiting for ${description}`);
}

test("shared parsers support quoted scalars, stable line counts, and rich links", () => {
  assert.deepEqual(
    parseFrontMatter(
      '---\nstatus: "active"\nowner: \'docs team\' # comment\n---\n# Title\n',
    ),
    { owner: "docs team", status: "active" },
  );
  assert.equal(countLines("a\n"), 1);
  assert.equal(countLines("a\n\n"), 2);
  assert.equal(classifyMarkdownTarget("C:\\docs\\guide.md").type, "absolute");
  assert.equal(classifyMarkdownTarget("%2Fetc%2Fpasswd").type, "absolute");
  assert.equal(classifyMarkdownTarget("https://example.com").type, "external");
  assert.deepEqual(
    [...markdownAnchors("# Hello, 世界!\n## Repeat\n## Repeat\n<a id=\"custom\"></a>\n")],
    ["hello-世界", "repeat", "repeat-1", "custom"],
  );
  assert.deepEqual(
    extractMarkdownLinks(
      "[parentheses](docs/a(1).md)\n[spaces](<docs/a b.md>)\n[title](docs/a.md \"A\")\n[windows](C:\\docs\\guide.md)\n`[ignored](missing.md)`\n```md\n[ignored](also-missing.md)\n```\n[reference]: docs/ref.md\n[^note]: This is prose, not a link target.\n",
    ).map((link) => link.target),
    [
      "docs/a(1).md",
      "docs/a b.md",
      "docs/a.md",
      "C:\\docs\\guide.md",
      "docs/ref.md",
    ],
  );
});

test("document index is deterministic, queryable, encoded, and freshness checked", (t) => {
  const root = createRepository(t);
  write(root, "docs/README.md", activeDocument("Home", "ADR-001 Choose one owner."));
  write(
    root,
    "docs/domains/order flow/README (draft).md",
    activeDocument("Order flow", "TASK-123 Implement routing."),
  );

  const first = run(indexScript, ["generate", "--repo", root]);
  assert.equal(first.status, 0, first.stderr);
  const markdownPath = join(root, "docs/generated/document-index.md");
  const jsonPath = join(root, "docs/generated/document-index.json");
  const firstMarkdown = readFileSync(markdownPath, "utf8");
  const firstJson = readFileSync(jsonPath, "utf8");
  assert.match(firstMarkdown, /order%20flow\/README%20%28draft%29\.md/);
  assert.match(firstMarkdown, /node scripts\/document-index\.mjs query ADR-001/);

  const second = run(indexScript, ["generate", "--repo", root]);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(readFileSync(markdownPath, "utf8"), firstMarkdown);
  assert.equal(readFileSync(jsonPath, "utf8"), firstJson);

  const query = run(indexScript, ["query", "ADR-001", "--repo", root]);
  assert.equal(query.status, 0, query.stderr);
  const queryOutput = JSON.parse(query.stdout);
  assert.equal(queryOutput.matchCount, 1);
  assert.equal(queryOutput.matches[0].identifierMatches[0].id, "ADR-001");

  const current = run(indexScript, ["check", "--repo", root]);
  assert.equal(current.status, 0, current.stderr);
  write(root, "docs/README.md", activeDocument("Home", "ADR-002 New decision."));
  const stale = run(indexScript, ["check", "--repo", root]);
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /stale generated file/);

  const regenerated = run(indexScript, ["generate", "--repo", root]);
  assert.equal(regenerated.status, 0, regenerated.stderr);
  const refreshed = run(indexScript, ["check", "--repo", root]);
  assert.equal(refreshed.status, 0, refreshed.stderr);
});

test("document index watch mode refreshes outputs", async (t) => {
  const root = createRepository(t);
  write(root, "docs/README.md", activeDocument("Home", "ADR-001 Initial."));
  let stdout = "";
  let stderr = "";
  const watcher = spawn(process.execPath, [indexScript, "watch", "--repo", root], {
    cwd: repositoryRoot,
    env: { ...process.env, DOCS_INDEX_FORCE_POLLING: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  watcher.stdout.setEncoding("utf8");
  watcher.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  watcher.stderr.setEncoding("utf8");
  watcher.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  t.after(() => {
    if (watcher.exitCode === null) watcher.kill();
  });
  const jsonPath = join(root, "docs/generated/document-index.json");
  await waitFor(
    () => stdout.includes("Watching Markdown documents."),
    `watcher readiness${stderr ? ` (${stderr.trim()})` : ""}`,
    10_000,
  );
  assert.equal(existsSync(jsonPath), true);

  write(root, "docs/README.md", activeDocument("Home", "ADR-002 Refreshed."));
  await waitFor(() => {
    if (!existsSync(jsonPath)) return false;
    try {
      return readFileSync(jsonPath, "utf8").includes("ADR-002");
    } catch {
      return false;
    }
  }, `watch refresh${stderr ? ` (${stderr.trim()})` : ""}`, 10_000);
  watcher.kill();
});

test("governance checks every active document and honors configured exclusions", (t) => {
  const root = createRepository(t);
  write(root, "docs/README.md", activeDocument("Home"));
  write(root, "docs/reference/source.md", "# External source\n");
  write(root, "docs/STATUS.md", "# Missing metadata\n");

  const missing = run(governanceScript, ["--repo", root]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /docs\/STATUS\.md: missing YAML front matter/);

  write(
    root,
    "docs/STATUS.md",
    '---\nstatus: "active"\nowner: engineering\nlast-reviewed: 2026-08-03\n---\n\n# Status\n',
  );
  const valid = run(governanceScript, ["--repo", root]);
  assert.equal(valid.status, 0, valid.stderr);
  assert.match(valid.stdout, /2 active files/);

  write(root, "docs/misc/guide.md", activeDocument("Unknown category"));
  const unknown = run(governanceScript, ["--repo", root]);
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /unknown top-level documentation directory misc/);
});

test("governance validates real dates and archive boundaries", (t) => {
  const root = createRepository(t);
  write(
    root,
    "docs/README.md",
    "---\nstatus: active\nowner: engineering\nlast-reviewed: 2026-99-99\n---\n\n# Home\n",
  );
  write(
    root,
    "docs/archive/old.md",
    "---\nstatus: active\n---\n\n# Old\n",
  );
  const result = run(governanceScript, ["--repo", root]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /last-reviewed must be a real YYYY-MM-DD date/);
  assert.match(result.stderr, /archived documents cannot be active/);
});

test("link checker handles complex local destinations and ignores code fences", (t) => {
  const root = createRepository(t);
  write(root, "docs/a(1).md", "# Parentheses\n\n## Details here\n");
  write(root, "docs/space file.md", "# Spaces\n");
  write(
    root,
    "docs/README.md",
    '[one](a(1).md#details-here "Title")\n[two](<space file.md>)\n[ref]: a(1).md\n```md\n[ignored](missing.md)\n```\n',
  );
  const valid = run(linksScript, ["--repo", root]);
  assert.equal(valid.status, 0, valid.stderr);

  write(root, "docs/broken.md", "[missing](does-not-exist.md)\n");
  const broken = run(linksScript, ["--repo", root]);
  assert.equal(broken.status, 1);
  assert.match(broken.stderr, /docs\/broken\.md:1 -> does-not-exist\.md/);

  write(root, "docs/broken.md", "[missing](a(1).md#not-there)\n");
  const brokenAnchor = run(linksScript, ["--repo", root]);
  assert.equal(brokenAnchor.status, 1);
  assert.match(brokenAnchor.stderr, /missing anchor a\(1\)\.md#not-there/);
});

test("audit respects ignored directories and reports complete active metadata", (t) => {
  const root = createRepository(t);
  write(
    root,
    "docs/README.md",
    "---\nstatus: active\nowner: engineering\n---\n\n# Home\n",
  );
  write(root, ".tmp-validation/ignored.md", "# Ignored\n");
  const result = run(auditScript, ["--repo", root, "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.markdownFiles, 1);
  assert.deepEqual(report.missingMetadata, ["docs/README.md"]);
});

test("CLI and configuration errors fail before doing work", (t) => {
  for (const script of [auditScript, governanceScript, indexScript, linksScript]) {
    const help = run(script, ["--help"]);
    assert.equal(help.status, 0, help.stderr);
    assert.match(help.stdout, /^Usage:/);
  }

  const missingValue = run(indexScript, ["generate", "--repo"]);
  assert.equal(missingValue.status, 2);
  assert.match(missingValue.stderr, /Option requires a value: --repo/);

  const root = createRepository(t, {
    stableIdPrefixes: [],
    unexpectedSetting: true,
  });
  const invalidConfig = run(indexScript, ["generate", "--repo", root]);
  assert.equal(invalidConfig.status, 2);
  assert.match(invalidConfig.stderr, /stableIdPrefixes cannot be empty/);
  assert.match(invalidConfig.stderr, /unknown configuration field: unexpectedSetting/);
});
