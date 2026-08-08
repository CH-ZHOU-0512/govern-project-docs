import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
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

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cliScript = join(repositoryRoot, "bin", "govern-project-docs.mjs");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function runCli(argumentsList, cwd = repositoryRoot) {
  return spawnSync(process.execPath, [cliScript, ...argumentsList], {
    cwd,
    encoding: "utf8",
  });
}

test("package CLI exposes stable help and version commands", () => {
  const version = runCli(["--version"]);
  assert.equal(version.status, 0, version.stderr);
  assert.equal(version.stdout.trim(), "0.2.0");

  const help = runCli(["--help"]);
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /init\s+Install the runtime/);
  assert.match(help.stdout, /check\s+Run governance/);

  const unknown = runCli(["unknown"]);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /Unknown command: unknown/);
});

test("init is atomic, idempotent, checkable, and explicit about replacement", (t) => {
  const target = mkdtempSync(join(tmpdir(), "govern-project-docs-cli-"));
  t.after(() => rmSync(target, { force: true, recursive: true }));

  const dryRun = runCli([
    "init",
    "--repo",
    target,
    "--owner",
    "platform team",
    "--dry-run",
  ]);
  assert.equal(dryRun.status, 0, dryRun.stderr);
  assert.match(dryRun.stdout, /create scripts\/docs-toolkit\.mjs/);
  assert.match(dryRun.stdout, /generate docs\/generated\/document-index/);
  assert.equal(existsSync(join(target, "scripts")), false);

  const generatedIndexPath = join(
    target,
    "docs",
    "generated",
    "document-index.json",
  );
  mkdirSync(dirname(generatedIndexPath), { recursive: true });
  writeFileSync(generatedIndexPath, '{"ownedBy":"another-tool"}\n', "utf8");
  const foreignGeneratedFile = runCli([
    "init",
    "--repo",
    target,
    "--owner",
    "platform team",
  ]);
  assert.equal(foreignGeneratedFile.status, 1);
  assert.match(foreignGeneratedFile.stderr, /docs\/generated\/document-index\.json/);
  assert.equal(existsSync(join(target, "scripts")), false);
  rmSync(generatedIndexPath, { force: true });

  const initialized = runCli([
    "init",
    "--repo",
    target,
    "--owner",
    "platform team",
  ]);
  assert.equal(initialized.status, 0, initialized.stderr);
  assert.match(initialized.stdout, /9 written, 0 unchanged/);
  assert.match(initialized.stdout, /Indexed 3 Markdown files/);
  assert.equal(
    existsSync(generatedIndexPath),
    true,
  );
  const policyPath = join(
    target,
    "docs",
    "governance",
    "DOCUMENTATION_POLICY.md",
  );
  const policy = readFileSync(policyPath, "utf8");
  assert.match(policy, /owner: "platform team"/);
  assert.match(policy, /last-reviewed: \d{4}-\d{2}-\d{2}/);

  const checked = runCli(["check", "--repo", target]);
  assert.equal(checked.status, 0, checked.stderr);
  assert.match(checked.stdout, /Documentation governance passed/);
  assert.match(checked.stdout, /Document index is current/);
  assert.match(checked.stdout, /All local Markdown targets resolve/);

  const queried = runCli([
    "index",
    "query",
    "repository.documentation-governance",
    "--repo",
    target,
  ]);
  assert.equal(queried.status, 0, queried.stderr);
  const queryReport = JSON.parse(queried.stdout);
  assert.equal(queryReport.matchCount, 1);
  assert.equal(queryReport.matches[0].docId, "DOC-DOCUMENTATION-POLICY");

  const audit = runCli(["audit", "--repo", target, "--json"]);
  assert.equal(audit.status, 0, audit.stderr);
  const auditReport = JSON.parse(audit.stdout);
  assert.equal(auditReport.missingDocumentIds.length, 0);
  assert.equal(auditReport.duplicateAuthorityClaims.length, 0);

  const repeated = runCli([
    "init",
    "--repo",
    target,
    "--owner",
    "platform team",
  ]);
  assert.equal(repeated.status, 0, repeated.stderr);
  assert.match(repeated.stdout, /0 written, 9 unchanged/);

  appendFileSync(policyPath, "\nLocal customization.\n", "utf8");
  const customized = readFileSync(policyPath, "utf8");
  const conflicted = runCli([
    "init",
    "--repo",
    target,
    "--owner",
    "platform team",
  ]);
  assert.equal(conflicted.status, 1);
  assert.match(conflicted.stderr, /stopped before writing any files/);
  assert.equal(readFileSync(policyPath, "utf8"), customized);

  const forced = runCli([
    "init",
    "--repo",
    target,
    "--owner",
    "platform team",
    "--force",
  ]);
  assert.equal(forced.status, 0, forced.stderr);
  assert.doesNotMatch(readFileSync(policyPath, "utf8"), /Local customization/);
});

test("npm package contains the executable runtime without repository-only files", () => {
  const packed = spawnSync(
    npmCommand,
    ["pack", "--dry-run", "--json", "--ignore-scripts"],
    {
      cwd: repositoryRoot,
      encoding: "utf8",
      shell: process.platform === "win32",
    },
  );
  assert.equal(packed.status, 0, packed.stderr);
  const [manifest] = JSON.parse(packed.stdout);
  const paths = new Set(manifest.files.map((file) => file.path));
  assert.equal(paths.has("bin/govern-project-docs.mjs"), true);
  assert.equal(paths.has("scripts/audit-docs.mjs"), true);
  assert.equal(paths.has("assets/runtime/docs-toolkit.mjs"), true);
  assert.equal(paths.has("assets/templates/docs-governance.config.json"), true);
  assert.equal(paths.has("tests/cli.test.mjs"), false);
  assert.equal(paths.has("site/index.html"), false);
});
