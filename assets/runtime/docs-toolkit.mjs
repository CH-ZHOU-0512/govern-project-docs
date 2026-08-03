import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from "node:path";

export const defaultIgnoredDirectories = new Set([
  ".code-review-graph",
  ".git",
  ".next",
  ".tmp",
  ".tmp-validation",
  ".venv",
  ".worktrees",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
  "target",
  "vendor",
]);
const markdownEscapableCharacters = new Set(
  "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~".split(""),
);

export function normalizePath(value) {
  return value.split(sep).join("/");
}

export function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function repositoryPath(repositoryRoot, path) {
  return normalizePath(relative(repositoryRoot, path));
}

export function parseCliArguments(
  argv,
  { booleanFlags = [], valueFlags = [] } = {},
) {
  const booleanNames = new Set(booleanFlags);
  const valueNames = new Set(valueFlags);
  const options = {};
  const positional = [];
  let positionalOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!positionalOnly && argument === "--") {
      positionalOnly = true;
      continue;
    }
    if (!positionalOnly && argument.startsWith("--")) {
      if (Object.hasOwn(options, argument)) {
        throw new Error(`Duplicate option: ${argument}`);
      }
      if (booleanNames.has(argument)) {
        options[argument] = true;
        continue;
      }
      if (!valueNames.has(argument)) {
        throw new Error(`Unknown option: ${argument}`);
      }
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error(`Option requires a value: ${argument}`);
      }
      options[argument] = value;
      index += 1;
      continue;
    }
    positional.push(argument);
  }

  return { options, positional };
}

export function collectMarkdownFiles(
  directory,
  { ignoredDirectories = new Set() } = {},
) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolutePath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(
        ...collectMarkdownFiles(absolutePath, { ignoredDirectories }),
      );
    } else if (
      entry.isFile() &&
      entry.name.toLowerCase().endsWith(".md")
    ) {
      files.push(absolutePath);
    }
  }
  return files.sort((left, right) =>
    compareText(normalizePath(left), normalizePath(right)),
  );
}

function stripYamlComment(value) {
  let quote;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote) {
      if (character === quote && value[index - 1] !== "\\") quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === "#" && /\s/.test(value[index - 1] ?? "")) {
      return value.slice(0, index).trimEnd();
    }
  }
  return value;
}

function parseYamlScalar(rawValue) {
  const value = stripYamlComment(rawValue.trim());
  if (value.startsWith('"') && value.endsWith('"')) {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  return value;
}

function parseYamlInlineArray(rawValue) {
  const value = stripYamlComment(rawValue.trim());
  if (!value.startsWith("[") || !value.endsWith("]")) return undefined;
  const inner = value.slice(1, -1).trim();
  if (!inner) return [];

  const items = [];
  let current = "";
  let quote;
  for (let index = 0; index < inner.length; index += 1) {
    const character = inner[index];
    if (quote) {
      current += character;
      if (character === quote && inner[index - 1] !== "\\") quote = undefined;
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      current += character;
      continue;
    }
    if (character === ",") {
      items.push(parseYamlScalar(current));
      current = "";
      continue;
    }
    current += character;
  }
  if (quote) return undefined;
  items.push(parseYamlScalar(current));
  return items;
}

function parseYamlValue(rawValue) {
  return parseYamlInlineArray(rawValue) ?? parseYamlScalar(rawValue);
}

export function parseFrontMatter(content) {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (lines[0] !== "---") return undefined;
  const closingIndex = lines.indexOf("---", 1);
  if (closingIndex < 0) return undefined;
  const metadata = {};
  const frontMatterLines = lines.slice(1, closingIndex);
  for (let index = 0; index < frontMatterLines.length; index += 1) {
    const line = frontMatterLines[index];
    const match = /^([a-z][a-z0-9-]*):(?:\s*(.*))?$/.exec(line);
    if (!match) continue;
    const rawValue = match[2] ?? "";
    if (rawValue.trim()) {
      metadata[match[1]] = parseYamlValue(rawValue);
      continue;
    }

    const items = [];
    let nextIndex = index + 1;
    for (; nextIndex < frontMatterLines.length; nextIndex += 1) {
      const candidate = frontMatterLines[nextIndex];
      if (/^\s*(?:#.*)?$/.test(candidate)) continue;
      const itemMatch = /^\s{2,}-\s+(.+)$/.exec(candidate);
      if (!itemMatch) break;
      items.push(parseYamlScalar(itemMatch[1]));
    }
    metadata[match[1]] = items.length > 0 ? items : "";
    if (items.length > 0) index = nextIndex - 1;
  }
  return metadata;
}

export function metadataStringArray(metadata, name) {
  const value = metadata?.[name];
  if (value === undefined || value === null || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

export function countLines(content) {
  if (content.length === 0) return 0;
  return content.replace(/\r?\n$/, "").split(/\r?\n/).length;
}

function readDestination(line, startIndex) {
  let index = startIndex;
  while (/\s/.test(line[index] ?? "")) index += 1;
  if (line[index] === "<") {
    let value = "";
    for (index += 1; index < line.length; index += 1) {
      if (line[index] === ">" && line[index - 1] !== "\\") return value;
      value += line[index];
    }
    return undefined;
  }

  let depth = 0;
  let value = "";
  for (; index < line.length; index += 1) {
    const character = line[index];
    if (character === "\\" && index + 1 < line.length) {
      if (markdownEscapableCharacters.has(line[index + 1])) {
        value += line[index + 1];
        index += 1;
        continue;
      }
      value += character;
      continue;
    }
    if (character === "(" ) {
      depth += 1;
      value += character;
      continue;
    }
    if (character === ")") {
      if (depth === 0) return value;
      depth -= 1;
      value += character;
      continue;
    }
    if (/\s/.test(character) && depth === 0) return value;
    value += character;
  }
  return value || undefined;
}

function fenceMarker(line) {
  const match = /^\s*(`{3,}|~{3,})/.exec(line);
  return match
    ? { character: match[1][0], length: match[1].length }
    : undefined;
}

export function extractMarkdownLinks(content) {
  const links = [];
  let fence;
  for (const [lineIndex, line] of content.split(/\r?\n/).entries()) {
    const marker = fenceMarker(line);
    if (marker) {
      if (!fence) fence = marker;
      else if (
        marker.character === fence.character &&
        marker.length >= fence.length
      ) {
        fence = undefined;
      }
      continue;
    }
    if (fence) continue;

    const definition = /^\s{0,3}\[(?!\^)[^\]]+\]:\s*/.exec(line);
    if (definition) {
      const target = readDestination(line, definition[0].length);
      if (target) links.push({ line: lineIndex + 1, target });
    }

    for (let index = 0; index < line.length; index += 1) {
      if (line[index] === "`" && line[index - 1] !== "\\") {
        let markerLength = 1;
        while (line[index + markerLength] === "`") markerLength += 1;
        const closing = line.indexOf("`".repeat(markerLength), index + markerLength);
        if (closing >= 0) {
          index = closing + markerLength - 1;
          continue;
        }
      }
      if (line[index] !== "[" || line[index - 1] === "\\") continue;
      let closingBracket = index + 1;
      while (closingBracket < line.length) {
        if (
          line[closingBracket] === "]" &&
          line[closingBracket - 1] !== "\\"
        ) {
          break;
        }
        closingBracket += 1;
      }
      if (line[closingBracket + 1] !== "(") continue;
      const target = readDestination(line, closingBracket + 2);
      if (target) links.push({ line: lineIndex + 1, target });
      index = closingBracket + 1;
    }
  }
  return links;
}

function headingSlug(value) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, "")
    .replace(/\s+/g, "-");
}

export function markdownAnchors(content) {
  const anchors = new Set();
  const slugCounts = new Map();
  let fence;
  for (const line of content.split(/\r?\n/)) {
    const marker = fenceMarker(line);
    if (marker) {
      if (!fence) fence = marker;
      else if (
        marker.character === fence.character &&
        marker.length >= fence.length
      ) {
        fence = undefined;
      }
      continue;
    }
    if (fence) continue;

    const heading = /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      const baseSlug = headingSlug(heading[1]);
      if (baseSlug) {
        const count = slugCounts.get(baseSlug) ?? 0;
        anchors.add(count === 0 ? baseSlug : `${baseSlug}-${count}`);
        slugCounts.set(baseSlug, count + 1);
      }
    }
    for (const match of line.matchAll(/\b(?:id|name)\s*=\s*["']([^"']+)["']/gi)) {
      anchors.add(match[1].toLowerCase());
    }
  }
  return anchors;
}

export function classifyMarkdownTarget(target) {
  const trimmed = target.trim();
  if (trimmed.startsWith("//")) {
    return { type: "external" };
  }
  const hashIndex = trimmed.indexOf("#");
  const withoutFragment =
    hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;
  let fragment;
  if (hashIndex >= 0) {
    try {
      fragment = decodeURIComponent(trimmed.slice(hashIndex + 1)).toLowerCase();
    } catch {
      return { type: "invalid-uri" };
    }
  }
  const queryIndex = withoutFragment.indexOf("?");
  const pathPart =
    queryIndex >= 0 ? withoutFragment.slice(0, queryIndex) : withoutFragment;
  if (!pathPart) return { fragment, type: "fragment" };
  if (isAbsolute(pathPart) || /^(?:[A-Za-z]:[\\/]|\/)/.test(pathPart)) {
    return { fragment, path: pathPart, type: "absolute" };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
    return { type: "external" };
  }
  try {
    const decodedPath = decodeURIComponent(pathPart);
    if (
      isAbsolute(decodedPath) ||
      /^(?:[A-Za-z]:[\\/]|\/)/.test(decodedPath)
    ) {
      return { fragment, path: decodedPath, type: "absolute" };
    }
    return { fragment, path: decodedPath, type: "local" };
  } catch {
    return { path: pathPart, type: "invalid-uri" };
  }
}

function stringArrayErrors(config, name, { nonEmpty = false } = {}) {
  if (!Array.isArray(config[name])) return [`${name} must be an array`];
  const errors = [];
  if (nonEmpty && config[name].length === 0) errors.push(`${name} cannot be empty`);
  if (config[name].some((value) => typeof value !== "string" || !value)) {
    errors.push(`${name} must contain non-empty strings`);
  }
  if (new Set(config[name]).size !== config[name].length) {
    errors.push(`${name} cannot contain duplicates`);
  }
  return errors;
}

export function isPathWithinRoot(root, path) {
  const relativePath = relative(root, path);
  return (
    relativePath === "" ||
    (!relativePath.startsWith(`..${sep}`) && relativePath !== ".." && !isAbsolute(relativePath))
  );
}

export function loadGovernanceConfig(configPath, repositoryRoot) {
  let config;
  try {
    config = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read documentation governance config: ${error.message}`);
  }

  const errors = [];
  const allowedKeys = new Set([
    "$schema",
    "activeDirectories",
    "allowedStatuses",
    "authorityKeyPattern",
    "authorityStatuses",
    "docsRoot",
    "excludedFromMetadata",
    "generatedRoot",
    "lineLimits",
    "requiredMetadata",
    "routingPaths",
    "routingPatterns",
    "schemaVersion",
    "stableIdPrefixes",
  ]);
  for (const key of Object.keys(config)) {
    if (!allowedKeys.has(key)) errors.push(`unknown configuration field: ${key}`);
  }
  if (![1, 2].includes(config.schemaVersion)) {
    errors.push("schemaVersion must be 1 or 2");
  }
  for (const name of ["docsRoot", "generatedRoot"]) {
    const value = config[name];
    if (typeof value !== "string" || !value.trim()) {
      errors.push(`${name} must be a non-empty string`);
      continue;
    }
    if (
      isAbsolute(value) ||
      !isPathWithinRoot(repositoryRoot, resolve(repositoryRoot, value))
    ) {
      errors.push(`${name} must stay within the repository`);
    }
  }
  errors.push(
    ...stringArrayErrors(config, "activeDirectories", { nonEmpty: true }),
    ...stringArrayErrors(config, "excludedFromMetadata"),
    ...stringArrayErrors(config, "requiredMetadata", { nonEmpty: true }),
    ...stringArrayErrors(config, "allowedStatuses", { nonEmpty: true }),
    ...stringArrayErrors(config, "routingPaths"),
    ...stringArrayErrors(config, "routingPatterns"),
    ...stringArrayErrors(config, "stableIdPrefixes", { nonEmpty: true }),
  );
  if (
    config.schemaVersion === 2 ||
    Object.hasOwn(config, "authorityStatuses")
  ) {
    errors.push(
      ...stringArrayErrors(config, "authorityStatuses", { nonEmpty: true }),
    );
  }
  if (
    config.schemaVersion === 2 ||
    Object.hasOwn(config, "authorityKeyPattern")
  ) {
    if (
      typeof config.authorityKeyPattern !== "string" ||
      !config.authorityKeyPattern
    ) {
      errors.push("authorityKeyPattern must be a non-empty string");
    }
  }
  if (
    !config.lineLimits ||
    typeof config.lineLimits !== "object" ||
    Array.isArray(config.lineLimits)
  ) {
    errors.push("lineLimits must be an object");
  } else {
    if (!Number.isInteger(config.lineLimits.default) || config.lineLimits.default < 1) {
      errors.push("lineLimits.default must be a positive integer");
    }
    for (const [path, limit] of Object.entries(config.lineLimits)) {
      if (!Number.isInteger(limit) || limit < 1) {
        errors.push(`lineLimits.${path} must be a positive integer`);
      }
    }
  }
  for (const pattern of config.routingPatterns ?? []) {
    try {
      new RegExp(pattern);
    } catch {
      errors.push(`routingPatterns contains invalid regular expression: ${pattern}`);
    }
  }
  const authorityKeyPattern =
    typeof config.authorityKeyPattern === "string" &&
    config.authorityKeyPattern
      ? config.authorityKeyPattern
      : "^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$";
  try {
    new RegExp(authorityKeyPattern);
  } catch {
    errors.push("authorityKeyPattern must be a valid regular expression");
  }
  const authorityStatuses = Array.isArray(config.authorityStatuses)
    ? config.authorityStatuses
    : ["accepted", "active"].filter((status) =>
        config.allowedStatuses?.includes(status),
      );
  if (config.schemaVersion === 2 && authorityStatuses.length === 0) {
    errors.push("authorityStatuses must include at least one allowed status");
  }
  for (const status of authorityStatuses) {
    if (!config.allowedStatuses?.includes(status)) {
      errors.push(`authorityStatuses contains status not present in allowedStatuses: ${status}`);
    }
  }
  for (const prefix of config.stableIdPrefixes ?? []) {
    if (!/^[A-Z][A-Z0-9]*$/.test(prefix)) {
      errors.push(`stableIdPrefixes contains invalid prefix: ${prefix}`);
    }
  }
  if (
    Array.isArray(config.activeDirectories) &&
    Array.isArray(config.excludedFromMetadata)
  ) {
    const excluded = new Set(config.excludedFromMetadata);
    for (const directory of config.activeDirectories) {
      if (excluded.has(directory)) {
        errors.push(`${directory} cannot be both active and excluded from metadata`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid documentation governance config:\n- ${errors.join("\n- ")}`);
  }
  return { ...config, authorityKeyPattern, authorityStatuses };
}

export function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function encodeMarkdownPath(path) {
  return normalizePath(path)
    .split("/")
    .map((segment) =>
      encodeURIComponent(segment).replace(/[!'()*]/g, (character) =>
        `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
      ),
    )
    .join("/");
}

export function writeFileAtomic(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}`;
  try {
    writeFileSync(temporaryPath, content, "utf8");
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}
