import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const siteUrl = "https://ch-zhou-0512.github.io/govern-project-docs/";

async function text(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

test("Pages landing page exposes canonical and crawler metadata", async () => {
  const html = await text("site/index.html");

  assert.match(html, new RegExp(`<link rel="canonical" href="${siteUrl}"`));
  assert.match(html, /<meta name="robots" content="index, follow,/);
  assert.match(html, /"@type": "SoftwareSourceCode"/);
  assert.match(html, /OAI|AI Agent/);
});

test("Pages crawler files explicitly allow OAI-SearchBot", async () => {
  const [robots, sitemap] = await Promise.all([
    text("site/robots.txt"),
    text("site/sitemap.xml"),
  ]);

  assert.match(robots, /User-agent: OAI-SearchBot\s+Allow: \/\s+/);
  assert.match(robots, new RegExp(`Sitemap: ${siteUrl}sitemap\\.xml`));
  assert.match(sitemap, new RegExp(`<loc>${siteUrl}</loc>`));
});

test("Pages workflow assembles every referenced media asset", async () => {
  const workflow = await text(".github/workflows/pages.yml");

  assert.match(workflow, /actions\/configure-pages@v5/);
  assert.match(workflow, /actions\/upload-pages-artifact@v4/);
  assert.match(workflow, /actions\/deploy-pages@v4/);

  await Promise.all([
    access(path.join(root, "assets/media/share-cover.png")),
    access(path.join(root, "assets/media/readme-demo.png")),
  ]);
});
