import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

function load(path, imports = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const module = { exports: {} };
  vm.runInNewContext(outputText, { module, exports: module.exports, Request, Response, URL, console, require: name => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  } });
  return module.exports;
}
const slug = load('src/lib/blogSlug.ts');
const saved = { id: 'uploaded-post', slug: '/travel-trends-in-india-2026', title: 'Travel Trends', content: 'Keep this article intact.' };
let written, invalidated;
const route = load('src/app/api/content/[collection]/route.ts', {
  'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
  '@/lib/blogSlug': slug,
  '@/lib/db': { isDbConfigured: () => true },
  '@/lib/admin/auth': { requireAdmin: request => request.headers.get('x-test-admin') === 'yes' },
  '@/lib/packageDates': { PackageDateError: class extends Error {} },
  '@/lib/content/cache': { listCachedPublicContent: async () => [saved], invalidatePublicContent: key => { invalidated = key; } },
  '@/lib/content/db': {
    isCollectionKey: key => ['blog', 'gallery'].includes(key),
    listContent: async () => [saved],
    createContentItem: async (_, item) => { written = item; return item; },
    updateContentItem: async (_, id, patch) => { written = patch; return { ...saved, ...patch, id }; },
  },
});
const context = { params: Promise.resolve({ collection: 'blog' }) };

test('cached and admin reads repair the affected slug without changing the article', async () => {
  for (const headers of [{}, { 'x-test-admin': 'yes' }]) {
    const response = await route.GET(new Request('https://example.com/api/content/blog', { headers }), context);
    const { items } = await response.json();
    assert.equal(items[0].slug, 'travel-trends-in-india-2026');
    assert.equal(items[0].content, saved.content);
    assert.equal(saved.slug, '/travel-trends-in-india-2026');
  }
});

test('POST and PATCH persist clean slugs and invalidate public content', async () => {
  for (const method of ['POST', 'PATCH']) {
    const input = { ...saved, slug: ' /travel-trends-in-india-2026/ ' };
    const body = method === 'POST' ? input : { id: saved.id, patch: input };
    const response = await route[method](new Request('https://example.com/api/content/blog', { method, headers: { 'Content-Type': 'application/json', 'x-test-admin': 'yes' }, body: JSON.stringify(body) }), context);
    assert.ok(response.ok);
    assert.equal(written.slug, 'travel-trends-in-india-2026');
    assert.equal(written.content, saved.content);
    assert.equal(invalidated, 'blog');
  }
});

test('partial edits and empty slugs retain the existing ID fallback', () => {
  assert.equal(slug.normalizeBlogSlug({ title: 'Updated' }).slug, undefined);
  for (const value of ['', ' ', '/', '///']) assert.equal(slug.normalizeBlogSlug({ slug: value }).slug, '');
  assert.equal(slug.normalizeBlogSlug({ slug: 'japan-tour-packages-2027' }).slug, 'japan-tour-packages-2027');
});

test('other collections and unauthorized writes are unchanged', async () => {
  const response = await route.GET(new Request('https://example.com/api/content/gallery'), { params: Promise.resolve({ collection: 'gallery' }) });
  assert.equal((await response.json()).items[0].slug, saved.slug);
  assert.equal((await route.POST(new Request('https://example.com/api/content/blog', { method: 'POST' }), context)).status, 401);
});
