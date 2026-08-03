import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import console from "node:console";
import process from "node:process";
import {
  classifyMarkdownTarget,
  collectMarkdownFiles,
  countLines,
  defaultIgnoredDirectories,
  extractMarkdownLinks,
  isPathWithinRoot,
  markdownAnchors,
  metadataStringArray,
  parseCliArguments,
  parseFrontMatter,
  repositoryPath as relativeRepositoryPath,
} from "../assets/runtime/docs-toolkit.mjs";

const nonActiveDocDirectories = new Set([
  "archive",
  "generated",
  "reference",
  "source",
]);
const usage = "Usage: node scripts/audit-docs.mjs [--repo <path>] [--json]";

let cli;
try {
  cli = parseCliArguments(process.argv.slice(2), {
    booleanFlags: ["--help", "--json"],
    valueFlags: ["--repo"],
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

const repositoryRoot = resolve(cli.options["--repo"] ?? process.cwd());
const jsonOutput = cli.options["--json"] ?? false;

if (!existsSync(repositoryRoot)) {
  console.error(`Repository does not exist: ${repositoryRoot}`);
  process.exit(2);
}

function repositoryPath(path) {
  return relativeRepositoryPath(repositoryRoot, path);
}

function firstHeading(lines) {
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(?:```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^#\s+(.+?)\s*#*\s*$/.exec(line);
    if (match) return match[1];
  }
  return undefined;
}

function categoryFor(path) {
  const segments = path.split("/");
  if (segments[0] !== "docs") return "repository";
  return segments[1] ?? "docs-root";
}

function isActiveDoc(path) {
  const segments = path.split("/");
  return (
    segments[0] === "docs" &&
    (segments.length === 2 || !nonActiveDocDirectories.has(segments[1]))
  );
}

function reviewReason(document) {
  if (
    ["archived", "superseded"].includes(document.status) &&
    !document.path.startsWith("docs/archive/")
  ) {
    return `${document.status} document is outside docs/archive`;
  }
  if (/^docs\/(?:project|superpowers)\//.test(document.path)) {
    return "legacy project or history directory should be reviewed";
  }
  if (document.path.startsWith("docs/archive/")) return undefined;
  if (
    /HANDOFF|P0_ACCEPTANCE|IMPLEMENTATION_PLAN/i.test(basename(document.path))
  ) {
    return "filename commonly represents completed or snapshot evidence";
  }
  return undefined;
}

const files = collectMarkdownFiles(repositoryRoot, {
  ignoredDirectories: defaultIgnoredDirectories,
});
const documents = files.map((absolutePath) => {
  const path = repositoryPath(absolutePath);
  const content = readFileSync(absolutePath, "utf8");
  const lines = content.split(/\r?\n/);
  const metadata = parseFrontMatter(content) ?? {};
  return {
    absolutePath,
    authorityFor: metadataStringArray(metadata, "authority-for"),
    category: categoryFor(path),
    charCount: content.length,
    lastReviewed: metadata["last-reviewed"] ?? null,
    lineCount: countLines(content),
    docId: metadata["doc-id"] ?? null,
    owner: metadata.owner ?? null,
    path,
    status: metadata.status ?? null,
    supersededBy: metadataStringArray(metadata, "superseded-by"),
    supersedes: metadataStringArray(metadata, "supersedes"),
    title: firstHeading(lines) ?? basename(path),
  };
});

const categoryCounts = Object.fromEntries(
  [...new Set(documents.map((document) => document.category))]
    .sort()
    .map((category) => [
      category,
      documents.filter((document) => document.category === category).length,
    ]),
);
const missingMetadata = documents
  .filter(
    (document) =>
      isActiveDoc(document.path) &&
      (!document.status || !document.owner || !document.lastReviewed),
  )
  .map((document) => document.path);
const missingDocumentIds = documents
  .filter((document) => isActiveDoc(document.path) && !document.docId)
  .map((document) => document.path);
const reviewCandidates = documents
  .map((document) => ({ path: document.path, reason: reviewReason(document) }))
  .filter((candidate) => candidate.reason);

const titleGroups = new Map();
for (const document of documents) {
  if (basename(document.path).toLowerCase() === "readme.md") continue;
  const key = document.title.trim().toLowerCase();
  titleGroups.set(key, [...(titleGroups.get(key) ?? []), document.path]);
}
const duplicateTitles = [...titleGroups.entries()]
  .filter(([, paths]) => paths.length > 1)
  .map(([title, paths]) => ({ paths, title }));

const authorityGroups = new Map();
for (const document of documents) {
  if (
    !isActiveDoc(document.path) ||
    !["accepted", "active"].includes(document.status)
  ) {
    continue;
  }
  for (const authority of document.authorityFor) {
    authorityGroups.set(authority, [
      ...(authorityGroups.get(authority) ?? []),
      document.path,
    ]);
  }
}
const duplicateAuthorityClaims = [...authorityGroups.entries()]
  .filter(([, paths]) => paths.length > 1)
  .map(([authority, paths]) => ({ authority, paths }));

const brokenLinks = [];
const nonPortableLinks = [];
const anchorCache = new Map();
function hasAnchor(file, fragment) {
  if (!fragment) return true;
  if (!anchorCache.has(file)) {
    anchorCache.set(file, markdownAnchors(readFileSync(file, "utf8")));
  }
  return anchorCache.get(file).has(fragment);
}

for (const document of documents) {
  const content = readFileSync(document.absolutePath, "utf8");
  for (const link of extractMarkdownLinks(content)) {
    const classified = classifyMarkdownTarget(link.target);
    if (classified.type === "external") {
      continue;
    }
    if (classified.type === "fragment") {
      if (!hasAnchor(document.absolutePath, classified.fragment)) {
        brokenLinks.push({
          line: link.line,
          path: document.path,
          target: link.target,
          reason: "heading anchor does not exist",
        });
      }
      continue;
    }
    if (classified.type === "absolute") {
      nonPortableLinks.push({
        line: link.line,
        path: document.path,
        target: link.target,
      });
      continue;
    }
    if (classified.type === "invalid-uri") {
      brokenLinks.push({
        line: link.line,
        path: document.path,
        target: link.target,
        reason: "invalid URI encoding",
      });
      continue;
    }
    const resolvedTarget = resolve(
      dirname(document.absolutePath),
      classified.path,
    );
    if (!isPathWithinRoot(repositoryRoot, resolvedTarget)) {
      nonPortableLinks.push({
        line: link.line,
        path: document.path,
        target: link.target,
      });
    } else if (!existsSync(resolvedTarget)) {
      brokenLinks.push({
        line: link.line,
        path: document.path,
        target: link.target,
        reason: "target does not exist",
      });
    } else if (
      classified.fragment &&
      resolvedTarget.toLowerCase().endsWith(".md") &&
      !hasAnchor(resolvedTarget, classified.fragment)
    ) {
      brokenLinks.push({
        line: link.line,
        path: document.path,
        target: link.target,
        reason: "heading anchor does not exist",
      });
    }
  }
}

const report = {
  brokenLinks,
  categoryCounts,
  duplicateTitles,
  duplicateAuthorityClaims,
  largestDocuments: documents
    .map(({ charCount, lineCount, path }) => ({ charCount, lineCount, path }))
    .sort((left, right) => right.charCount - left.charCount)
    .slice(0, 15),
  markdownFiles: documents.length,
  missingDocumentIds,
  missingMetadata,
  nonPortableLinks,
  repository: repositoryRoot,
  reviewCandidates,
  schemaVersion: 2,
};

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Documentation audit: ${repositoryRoot}`);
  console.log(`Markdown files: ${report.markdownFiles}`);
  console.log(`Categories: ${JSON.stringify(report.categoryCounts)}`);
  console.log(`Missing active metadata: ${report.missingMetadata.length}`);
  console.log(`Missing active document IDs: ${report.missingDocumentIds.length}`);
  console.log(`Duplicate non-README titles: ${report.duplicateTitles.length}`);
  console.log(
    `Duplicate active authority claims: ${report.duplicateAuthorityClaims.length}`,
  );
  console.log(`Review candidates: ${report.reviewCandidates.length}`);
  console.log(`Broken local links: ${report.brokenLinks.length}`);
  console.log(
    `Non-portable local links: ${report.nonPortableLinks.length}`,
  );
  console.log("Largest documents:");
  for (const document of report.largestDocuments.slice(0, 8)) {
    console.log(
      `- ${document.path}: ${document.lineCount} lines, ${document.charCount} chars`,
    );
  }
}
