import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import console from "node:console";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  classifyMarkdownTarget,
  collectMarkdownFiles,
  defaultIgnoredDirectories,
  extractMarkdownLinks,
  isPathWithinRoot,
  markdownAnchors,
  parseCliArguments,
  repositoryPath,
} from "./docs-toolkit.mjs";

const usage = "Usage: node scripts/check-markdown-links.mjs [--repo <path>]";

let cli;
try {
  cli = parseCliArguments(process.argv.slice(2), {
    booleanFlags: ["--help"],
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

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(
  cli.options["--repo"] ?? resolve(scriptDirectory, ".."),
);

if (!existsSync(repositoryRoot)) {
  console.error(`Repository does not exist: ${repositoryRoot}`);
  process.exit(2);
}

const failures = [];
const anchorCache = new Map();
function hasAnchor(file, fragment) {
  if (!fragment) return true;
  if (!anchorCache.has(file)) {
    anchorCache.set(file, markdownAnchors(readFileSync(file, "utf8")));
  }
  return anchorCache.get(file).has(fragment);
}

for (const file of collectMarkdownFiles(repositoryRoot, {
  ignoredDirectories: defaultIgnoredDirectories,
})) {
  const content = readFileSync(file, "utf8");
  for (const link of extractMarkdownLinks(content)) {
    const source = `${repositoryPath(repositoryRoot, file)}:${link.line}`;
    const classified = classifyMarkdownTarget(link.target);
    if (classified.type === "external") {
      continue;
    }
    if (classified.type === "fragment") {
      if (!hasAnchor(file, classified.fragment)) {
        failures.push(`${source} -> missing anchor ${link.target}`);
      }
      continue;
    }
    if (classified.type === "absolute") {
      failures.push(`${source} -> non-portable ${link.target}`);
      continue;
    }
    if (classified.type === "invalid-uri") {
      failures.push(`${source} -> invalid URI ${link.target}`);
      continue;
    }
    const resolvedTarget = resolve(dirname(file), classified.path);
    if (!isPathWithinRoot(repositoryRoot, resolvedTarget)) {
      failures.push(`${source} -> non-portable ${link.target}`);
    } else if (!existsSync(resolvedTarget)) {
      failures.push(`${source} -> ${link.target}`);
    } else if (
      classified.fragment &&
      resolvedTarget.toLowerCase().endsWith(".md") &&
      !hasAnchor(resolvedTarget, classified.fragment)
    ) {
      failures.push(`${source} -> missing anchor ${link.target}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Broken or non-portable local Markdown targets:");
  for (const failure of failures.sort()) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("All local Markdown targets resolve.");
}
