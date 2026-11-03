import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

const require = createRequire(import.meta.url);
function load(path, overrides = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } });
  const loaded = { exports: {} };
  vm.runInNewContext(outputText, { module: loaded, exports: loaded.exports, URL,
    require: (name) => overrides[name] ?? require(name) }, { filename: path });
  return loaded.exports;
}
const links = load("src/lib/blogContent.ts");
const BlogContent = load("src/components/blog/BlogContent.tsx", { "@/lib/blogContent": links }).default;
const render = (content) => renderToStaticMarkup(createElement(BlogContent, { content }));

test("old plain-text posts keep their paragraphs and literal HTML stays escaped", () => {
  const html = render('First paragraph.\nAnother line.\n\nSecond <script>alert("x")</script>.');
  assert.equal((html.match(/<p /g) || []).length, 2);
  assert.ok(html.includes("First paragraph.\nAnother line."));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
});

test("multiple keyword links produce real anchors while preserving surrounding prose", () => {
  const content = `Explore ${links.contentLinkMarkup("Japan tours", "/packages?destination=Japan&style=family")} or ${links.contentLinkMarkup("travel guides", "https://example.com/guides")}.`;
  const html = render(content);
  assert.ok(html.includes('href="/packages?destination=Japan&amp;style=family"'));
  assert.ok(html.includes('href="https://example.com/guides"'));
  assert.ok(html.includes(">Japan tours</a> or "));
  assert.ok(html.endsWith(".</p></div>"));
});

test("unsafe schemes, protocol-relative URLs, backslashes and disguised control characters are rejected", () => {
  for (const href of ["javascript:alert(1)", "data:text/html,bad", "//evil.example", "/\\evil.example", "java\nscript:alert(1)", "https://user:pass@example.com", "https://", "/page name"]) {
    assert.equal(links.normalizeContentUrl(href), null, href);
    assert.throws(() => links.contentLinkMarkup("Keyword", href));
    assert.ok(!render(`[Keyword](${href})`).includes("<a "), href);
  }
});

test("brackets and backslashes in keyword labels round-trip as visible text", () => {
  const label = "Japan [family] \\ tours";
  const content = links.contentLinkMarkup(label, "https://example.com/Japan_(travel)");
  const [parsed] = links.contentLinks(content);
  assert.equal(parsed.label, label);
  assert.equal(parsed.href, "https://example.com/Japan_%28travel%29");
  assert.ok(render(content).includes(`>${label}</a>`));
});

test("hand-entered balanced parentheses work and malformed links remain text", () => {
  assert.equal(links.contentLinks("[Japan](https://example.com/Japan_(travel))")[0].href, "https://example.com/Japan_%28travel%29");
  for (const content of ["[Japan](https://example.com", "[Japan]", "ordinary [notes]", "[Japan](bad-url)"]) {
    assert.equal(links.contentLinks(content).length, 0);
    assert.ok(!render(content).includes("<a "));
  }
});

test("link ranges allow editing one occurrence without replacing other keywords", () => {
  const original = "Japan and " + links.contentLinkMarkup("Japan", "/old") + " and Japan";
  const link = links.contentLinks(original)[0];
  const updated = original.slice(0, link.start) + links.contentLinkMarkup(link.label, "/new") + original.slice(link.end);
  assert.equal(updated, "Japan and [Japan](/new) and Japan");
  assert.equal(original.slice(0, link.start) + link.label + original.slice(link.end), "Japan and Japan and Japan");
});

test("empty or multiline keywords cannot create a broken inline link", () => {
  for (const keyword of ["", "  ", "one\ntwo", "one\rtwo"]) assert.throws(() => links.contentLinkMarkup(keyword, "/packages"));
});
