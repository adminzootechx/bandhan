import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const source = readFileSync(new URL('../src/proxy.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
const module = { exports: {} };
const imports = {
  'next/server': { NextResponse: { next: () => ({ allowed: true }), redirect: (url, status = 307) => ({ location: url.href, status }) } },
  '@/lib/admin/auth': { ADMIN_COOKIE: 'admin', isValidToken: () => false },
  '@/lib/auth/agentSession': { AGENT_COOKIE: 'agent', verifyAgentSession: () => false },
  '@/lib/auth/session': { USER_COOKIE: 'user', verifySession: token => token === 'valid' },
};
vm.runInNewContext(outputText, { module, exports: module.exports, require: name => imports[name], URL });
const { proxy, config } = module.exports;
function request(path, authenticated = false) {
  const nextUrl = new URL(path, 'https://bandhantours.com');
  nextUrl.clone = () => new URL(nextUrl);
  return { nextUrl, cookies: { get: () => authenticated ? { value: 'valid' } : undefined } };
}
test('legacy custom booking URLs retain selections at the clean URL', () => {
  for (const type of ['destination', 'custom']) {
    const response = proxy(request(`/book?type=${type}&id=kerala&month=2027-01`));
    assert.equal(response.status, 308);
    assert.equal(response.location, 'https://bandhantours.com/plan-a-custom-trip?id=kerala&month=2027-01');
  }
});
test('custom trip still requires login and preserves the clean return URL', () => {
  assert.ok(config.matcher.includes('/plan-a-custom-trip'));
  const response = proxy(request('/plan-a-custom-trip?id=kerala'));
  const url = new URL(response.location);
  assert.equal(url.pathname, '/signin');
  assert.equal(url.searchParams.get('from'), '/plan-a-custom-trip?id=kerala');
  assert.equal(proxy(request('/plan-a-custom-trip', true)).allowed, true);
});
test('package booking keeps its existing selection and authentication', () => {
  const response = proxy(request('/book?type=package&id=bali'));
  assert.equal(new URL(response.location).searchParams.get('from'), '/book?type=package&id=bali');
  assert.equal(proxy(request('/book?type=package&id=bali', true)).allowed, true);
});
