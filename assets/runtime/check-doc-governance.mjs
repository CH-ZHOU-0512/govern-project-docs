import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import console from "node:console";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  collectMarkdownFiles,
  countLines,
  isValidIsoDate,
  loadGovernanceConfig,
  metadataStringArray,
  normalizePath,
  parseCliArguments,
  parseFrontMatter,
  repositoryPath,
} from "./docs-toolkit.mjs";

const usage =
  "Usage: node scripts/check-doc-governance.mjs [--repo <path>] [--config <path>]";

let cli;
try {
  cli = parseCliArguments(process.argv.slice(2), {
    booleanFlags: ["--help"],
    valueFlags: ["--config", "--repo"],
  });
  if (cli.positional.length > 0) {
    throw new Error(`Unexpected argument: ${cli.positional[0]}`);
  }
} catch (error) {
  console.error(error.message);
  console.error(usage);
  process.exit(2);
}
if (cli.options["--help"]) {
  console.log(usage);
  process.exit(0);
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(
  cli.options["--repo"] ?? resolve(scriptDirectory, ".."),
);
const configPath = resolve(
  cli.options["--config"] ??
    join(repositoryRoot, "scripts", "docs-governance.config.json"),
);
if (!existsSync(configPath)) {
  console.error(`Missing documentation governance config: ${configPath}`);
  process.exit(2);
}
let config;
try {
  config = loadGovernanceConfig(configPath, repositoryRoot);
} catch (error) {
  console.error(error.message);
  process.exit(2);
}
const docsRoot = join(repositoryRoot, config.docsRoot);
const generatedRoot = join(repositoryRoot, config.generatedRoot);
const allowedStatuses = new Set(config.allowedStatuses);
const authorityStatuses = new Set(config.authorityStatuses);
const authorityKeyPattern = new RegExp(config.authorityKeyPattern);
const escapedPrefixes = config.stableIdPrefixes.map((prefix) =>
  prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
);
const documentIdPattern = new RegExp(
  `^(?:${escapedPrefixes.join("|")})-[A-Z0-9][A-Z0-9-]*$`,
);
const failures = [];

function projectPath(path) {
  return repositoryPath(repositoryRoot, path);
}

function lineLimitFor(path) {
  const docsPath = normalizePath(relative(docsRoot, path));
  return (
    config.lineLimits[docsPath] ??
    config.lineLimits[basename(path)] ??
    config.lineLimits.default
  );
}

const excludedDirectories = new Set(config.excludedFromMetadata);
const knownDirectories = new Set([
  ...config.activeDirectories,
  ...config.excludedFromMetadata,
]);
const activeFiles = [];
for (const file of collectMarkdownFiles(docsRoot)) {
  const docsPath = normalizePath(relative(docsRoot, file));
  const segments = docsPath.split("/");
  const topLevelDirectory = segments.length > 1 ? segments[0] : undefined;
  if (topLevelDirectory && !knownDirectories.has(topLevelDirectory)) {
    failures.push(
      `${projectPath(file)}: unknown top-level documentation directory ${topLevelDirectory}`,
    );
  }
  if (
    topLevelDirectory &&
    excludedDirectories.has(topLevelDirectory)
  ) {
    continue;
  }
  activeFiles.push(file);
}

for (const file of activeFiles) {
  const path = projectPath(file);
  const content = readFileSync(file, "utf8");
  const metadata = parseFrontMatter(content);
  if (!metadata) {
    failures.push(`${path}: missing YAML front matter`);
    continue;
  }
  for (const field of config.requiredMetadata) {
    if (!metadata[field]) failures.push(`${path}: missing ${field}`);
  }
  if (metadata.status && !allowedStatuses.has(metadata.status)) {
    failures.push(`${path}: invalid status ${metadata.status}`);
  }
  if (
    metadata["last-reviewed"] &&
    !isValidIsoDate(metadata["last-reviewed"])
  ) {
    failures.push(`${path}: last-reviewed must be a real YYYY-MM-DD date`);
  }
  if (metadata.status === "superseded" && !metadata["superseded-by"]) {
    failures.push(`${path}: superseded documents must declare superseded-by`);
  }
  const lineCount = countLines(content);
  const lineLimit = lineLimitFor(file);
  if (lineCount > lineLimit) {
    failures.push(
      `${path}: ${lineCount} lines exceeds the ${lineLimit}-line active limit`,
    );
  }
}

function metadataList(record, field) {
  const rawValue = record.metadata[field];
  if (rawValue === undefined || rawValue === "") return [];
  const values = metadataStringArray(record.metadata, field);
  if (
    values.some((value) => typeof value !== "string" || !value.trim())
  ) {
    failures.push(`${record.path}: ${field} must contain non-empty strings`);
    return [];
  }
  const normalized = values.map((value) => value.trim());
  if (new Set(normalized).size !== normalized.length) {
    failures.push(`${record.path}: ${field} cannot contain duplicates`);
  }
  return [...new Set(normalized)];
}

const generatedPrefix = `${projectPath(generatedRoot)}/`;
const archivePrefix = `${projectPath(join(docsRoot, "archive"))}/`;
const records = collectMarkdownFiles(docsRoot)
  .map((file) => ({
    file,
    metadata: parseFrontMatter(readFileSync(file, "utf8")) ?? {},
    path: projectPath(file),
  }))
  .filter((record) => !record.path.startsWith(generatedPrefix))
  .map((record) => ({
    ...record,
    archived: record.path.startsWith(archivePrefix),
    authorityFor: metadataList(record, "authority-for"),
    supersededBy: metadataList(record, "superseded-by"),
    supersedes: metadataList(record, "supersedes"),
  }));

const recordsById = new Map();
const authorityClaims = new Map();
for (const record of records) {
  const rawDocumentId = record.metadata["doc-id"];
  let documentId;
  if (rawDocumentId) {
    if (typeof rawDocumentId !== "string") {
      failures.push(
        `${record.path}: doc-id must match a configured stable ID prefix`,
      );
    } else if (!documentIdPattern.test(rawDocumentId.trim())) {
      failures.push(
        `${record.path}: doc-id must match a configured stable ID prefix`,
      );
    } else {
      documentId = rawDocumentId.trim();
    }
  }
  record.documentId = documentId;
  if (documentId) {
    if (recordsById.has(documentId)) {
      failures.push(
        `${record.path}: duplicate doc-id ${documentId} also used by ${recordsById.get(documentId).path}`,
      );
    } else {
      recordsById.set(documentId, record);
    }
  }

  for (const key of record.authorityFor) {
    if (!authorityKeyPattern.test(key)) {
      failures.push(
        `${record.path}: authority-for contains invalid key ${key}`,
      );
    }
  }
  if (record.archived && record.authorityFor.length > 0) {
    failures.push(`${record.path}: archived documents cannot declare authority-for`);
  }
  if (
    ["archived", "superseded"].includes(record.metadata.status) &&
    record.authorityFor.length > 0
  ) {
    failures.push(
      `${record.path}: ${record.metadata.status} documents cannot declare authority-for`,
    );
  }
  if (
    !record.archived &&
    authorityStatuses.has(record.metadata.status)
  ) {
    for (const key of record.authorityFor) {
      const paths = authorityClaims.get(key) ?? [];
      paths.push(record.path);
      authorityClaims.set(key, paths);
    }
  }
}

for (const [key, paths] of authorityClaims) {
  if (paths.length > 1) {
    failures.push(
      `authority ${key} has multiple active documents: ${paths.sort().join(", ")}`,
    );
  }
}

for (const record of records) {
  if (record.archived && record.metadata.status === "active") {
    failures.push(`${record.path}: archived documents cannot be active`);
  }
  for (const field of ["supersedes", "superseded-by"]) {
    const references =
      field === "supersedes" ? record.supersedes : record.supersededBy;
    for (const documentId of references) {
      if (!documentIdPattern.test(documentId)) {
        failures.push(
          `${record.path}: ${field} contains invalid document ID ${documentId}`,
        );
      } else if (documentId === record.documentId) {
        failures.push(`${record.path}: ${field} cannot reference its own doc-id`);
      } else if (!recordsById.has(documentId)) {
        failures.push(`${record.path}: ${field} references unknown doc-id ${documentId}`);
      }
    }
  }
}

for (const record of records) {
  if (!record.documentId) continue;
  for (const previousId of record.supersedes) {
    const previous = recordsById.get(previousId);
    if (!previous) continue;
    if (!previous.supersededBy.includes(record.documentId)) {
      failures.push(
        `${record.path}: supersedes ${previousId}, but ${previous.path} does not declare superseded-by ${record.documentId}`,
      );
    }
    if (!["archived", "superseded"].includes(previous.metadata.status)) {
      failures.push(
        `${previous.path}: superseded document must have superseded or archived status`,
      );
    }
  }
  for (const replacementId of record.supersededBy) {
    const replacement = recordsById.get(replacementId);
    if (!replacement) continue;
    if (!replacement.supersedes.includes(record.documentId)) {
      failures.push(
        `${record.path}: superseded-by ${replacementId}, but ${replacement.path} does not declare supersedes ${record.documentId}`,
      );
    }
    if (!authorityStatuses.has(replacement.metadata.status)) {
      failures.push(
        `${replacement.path}: replacement document must use an authority status`,
      );
    }
  }
}

const replacementEdges = new Map(
  records
    .filter((record) => record.documentId)
    .map((record) => [record.documentId, new Set(record.supersededBy)]),
);
for (const record of records) {
  if (!record.documentId) continue;
  for (const previousId of record.supersedes) {
    if (replacementEdges.has(previousId)) {
      replacementEdges.get(previousId).add(record.documentId);
    }
  }
}
const visited = new Set();
const visiting = new Set();
function visitReplacement(documentId, path = []) {
  if (visiting.has(documentId)) {
    const cycleStart = path.indexOf(documentId);
    const cycle = [...path.slice(cycleStart), documentId];
    failures.push(`supersession cycle detected: ${cycle.join(" -> ")}`);
    return;
  }
  if (visited.has(documentId)) return;
  visiting.add(documentId);
  for (const replacementId of replacementEdges.get(documentId) ?? []) {
    if (replacementEdges.has(replacementId)) {
      visitReplacement(replacementId, [...path, documentId]);
    }
  }
  visiting.delete(documentId);
  visited.add(documentId);
}
for (const documentId of replacementEdges.keys()) {
  visitReplacement(documentId);
}

for (const file of collectMarkdownFiles(generatedRoot)) {
  if (!readFileSync(file, "utf8").startsWith("<!-- GENERATED by ")) {
    failures.push(`${projectPath(file)}: missing generated-file banner`);
  }
}

if (failures.length > 0) {
  console.error("Documentation governance violations:");
  for (const failure of failures.sort()) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Documentation governance passed for ${activeFiles.length} active files.`,
  );
}
