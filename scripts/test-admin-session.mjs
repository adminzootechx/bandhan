import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, overrides = {}, globals = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } });
  const testModule = { exports: {} };
  vm.runInNewContext(outputText, { module: testModule, exports: testModule.exports, Buffer, URL,
    require: (name) => Object.hasOwn(overrides, name) ? overrides[name] : require(name), ...globals }, { filename: path });
  return testModule.exports;
}
const json = (body, status = 200) => Response.json(body, { status });
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("an expired save waits for valid credentials, then retries the unchanged package", async () => {
  let signedIn = false;
  const writes = [];
  const fetch = async (url, options) => {
    assert.equal(options.credentials, "same-origin");
    if (url === "/api/admin/login") {
      signedIn = JSON.parse(options.body).password === "correct-password";
      return signedIn ? json({ ok: true }) : json({ error: "Incorrect password." }, 401);
    }
    writes.push(options);
    return signedIn ? json({ ok: true }) : json({ error: "Not authorized." }, 401);
  };
  const session = load("src/lib/admin/session.ts", {}, { fetch });
  const unsubscribe = session.subscribeAdminSession(() => {});
  const body = JSON.stringify({ id: "tour", patch: { title: "Vaishnodevi & Kashmir Paradise", price: "69,889", itinerary: [{ day: 1, title: "Arrival" }] } });
  const saving = session.adminFetch("/api/content/packages", { method: "PATCH", body });
  await flush();
  assert.equal(session.needsAdminSignIn(), true);
  assert.equal(writes.length, 1);
  await assert.rejects(session.signInAdminAgain("wrong-password"), /Incorrect password/);
  assert.equal(writes.length, 1);
  assert.equal(session.needsAdminSignIn(), true);
  await session.signInAdminAgain("correct-password");
  assert.equal((await saving).ok, true);
  assert.equal(writes.length, 2);
  assert.equal(writes[1].body, body);
  assert.equal(writes[1].method, "PATCH");
  assert.equal(session.needsAdminSignIn(), false);
  unsubscribe();
});

test("cancelling recovery leaves the unsaved request unsubmitted and releases the saving state", async () => {
  let calls = 0;
  const session = load("src/lib/admin/session.ts", {}, { fetch: async () => { calls += 1; return json({}, 401); } });
  const unsubscribe = session.subscribeAdminSession(() => {});
  const saving = session.adminFetch("/api/content/packages", { method: "POST", body: "draft" });
  const rejected = assert.rejects(saving, /changes are still in the editor/);
  await flush();
  session.cancelAdminSignIn();
  await rejected;
  assert.equal(calls, 1);
  assert.equal(session.needsAdminSignIn(), false);
  unsubscribe();
});

test("concurrent rejected requests share one login prompt", async () => {
  let signedIn = false;
  let prompts = 0;
  const session = load("src/lib/admin/session.ts", {}, { fetch: async (url) => {
    if (url === "/api/admin/login") { signedIn = true; return json({ ok: true }); }
    return json({}, signedIn ? 200 : 401);
  } });
  const unsubscribe = session.subscribeAdminSession(() => { if (session.needsAdminSignIn()) prompts += 1; });
  const requests = [session.adminFetch("/api/content/packages"), session.adminFetch("/api/content/gallery")];
  await flush();
  assert.equal(prompts, 1);
  await session.signInAdminAgain("password");
  assert.equal((await Promise.all(requests)).every((response) => response.ok), true);
  unsubscribe();
});

test("server errors and still-rejected sessions never cause a retry loop", async () => {
  let calls = 0;
  const session = load("src/lib/admin/session.ts", {}, { fetch: async (url) => {
    calls += 1;
    return url === "/api/admin/login" ? json({ ok: true }) : json({}, url === "/broken" ? 500 : 401);
  } });
  const unsubscribe = session.subscribeAdminSession(() => {});
  assert.equal((await session.adminFetch("/broken")).status, 500);
  assert.equal(calls, 1);
  const saving = session.adminFetch("/unauthorized");
  await flush();
  await session.signInAdminAgain("password");
  assert.equal((await saving).status, 401);
  assert.equal(calls, 4);
  assert.equal(session.needsAdminSignIn(), false);
  unsubscribe();
});

test("image upload retains selected files while sign-in is restored", async () => {
  let signedIn = false;
  const uploads = [];
  const session = load("src/lib/admin/session.ts", {}, { fetch: async (url) => {
    if (url === "/api/admin/login") { signedIn = true; return json({ ok: true }); }
    assert.equal(url, "/api/admin/session");
    return json({}, signedIn ? 200 : 401);
  } });
  const unsubscribe = session.subscribeAdminSession(() => {});
  const images = load("src/lib/admin/imageLinks.ts", {
    "./session": session,
    "@/lib/imageHosts": { isImagePageLink: () => false },
    "@/lib/uploadthing": { uploadFiles: async (endpoint, options) => {
      uploads.push({ endpoint, files: options.files });
      return [{ ufsUrl: "https://example.com/photo.jpg" }];
    } },
  });
  const file = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
  const uploading = images.uploadImages([file]);
  await flush();
  assert.equal(uploads.length, 0);
  await session.signInAdminAgain("password");
  assert.deepEqual(Array.from(await uploading), ["https://example.com/photo.jpg"]);
  assert.equal(uploads[0].files[0], file);
  assert.equal(uploads[0].endpoint, "imageUploader");
  unsubscribe();
});

test("the session endpoint rejects missing and forged cookies and never caches its response", async () => {
  const auth = load("src/lib/admin/auth.ts", {}, { process: { env: {
    NODE_ENV: "production", ADMIN_PASSWORD: "test-password", ADMIN_SESSION_SECRET: "test-secret",
  } } });
  const { GET } = load("src/app/api/admin/session/route.ts", {
    "@/lib/admin/auth": auth,
  });
  for (const token of [null, "forged", auth.sessionToken()]) {
    const response = await GET(new Request("https://example.com/api/admin/session", {
      headers: token ? { cookie: `${auth.ADMIN_COOKIE}=${token}` } : {},
    }));
    assert.equal(response.status, token === auth.sessionToken() ? 200 : 401);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal(response.headers.has("set-cookie"), false);
  }
});

function monitorWith(fetch) {
  let now = 0;
  let tick = () => {};
  const window = Object.assign(new EventTarget(), { setInterval: (callback) => { tick = callback; return 1; }, clearInterval: () => { tick = () => {}; } });
  const document = Object.assign(new EventTarget(), { visibilityState: "visible" });
  class Clock extends Date { static now() { return now; } }
  const session = load("src/lib/admin/session.ts", {}, { fetch, window, document, Date: Clock, AbortController });
  return { ...session, window, document, advance: (milliseconds) => { now += milliseconds; }, tick: () => tick() };
}

test("active editing renews the session beyond the original eight-hour lifetime", async () => {
  let renewals = 0;
  const session = monitorWith(async (url, options) => {
    assert.equal(url, "/api/admin/session");
    assert.equal(options.method, "POST");
    assert.equal(options.credentials, "same-origin");
    renewals += 1;
    return json({ ok: true });
  });
  const stop = session.startAdminSessionMonitor();
  await flush();
  for (let index = 0; index < 100; index += 1) {
    session.advance(5 * 60 * 1000);
    session.window.dispatchEvent(new Event("keydown"));
    await flush();
  }
  assert.equal(renewals, 101);
  stop();
});

test("idle and hidden tabs do not renew, while returning to work checks the session", async () => {
  let renewals = 0;
  const session = monitorWith(async () => { renewals += 1; return json({ ok: true }); });
  const stop = session.startAdminSessionMonitor();
  await flush();
  session.advance(60 * 60 * 1000);
  session.tick();
  await flush();
  assert.equal(renewals, 1);
  session.document.visibilityState = "hidden";
  session.window.dispatchEvent(new Event("keydown"));
  await flush();
  assert.equal(renewals, 1);
  session.document.visibilityState = "visible";
  session.document.dispatchEvent(new Event("visibilitychange"));
  await flush();
  assert.equal(renewals, 2);
  session.window.dispatchEvent(new Event("pointerdown"));
  await flush();
  assert.equal(renewals, 2, "activity must not flood the renewal endpoint");
  stop();
  session.advance(60 * 60 * 1000);
  session.window.dispatchEvent(new Event("keydown"));
  session.tick();
  await flush();
  assert.equal(renewals, 2, "logout or unmount removes the activity monitor");
});

test("a session that expired while away prompts for sign-in before further editing", async () => {
  let valid = false;
  const session = monitorWith(async (url) => {
    if (url === "/api/admin/login") { valid = true; return json({ ok: true }); }
    return json({}, valid ? 200 : 401);
  });
  const unsubscribe = session.subscribeAdminSession(() => {});
  const stop = session.startAdminSessionMonitor();
  await flush();
  assert.equal(session.needsAdminSignIn(), true);
  await session.signInAdminAgain("password");
  await flush();
  assert.equal(session.needsAdminSignIn(), false);
  stop();
  unsubscribe();
});

test("stopping the monitor ignores a late unauthorized response", async () => {
  let finish;
  const session = monitorWith(() => new Promise((resolve) => { finish = resolve; }));
  const unsubscribe = session.subscribeAdminSession(() => {});
  session.startAdminSessionMonitor();
  session.stopAdminSessionMonitor();
  finish(json({}, 401));
  await flush();
  assert.equal(session.needsAdminSignIn(), false);
  unsubscribe();
});

test("a late rejected request uses the login already restored by another request", async () => {
  let valid = false;
  let finish;
  let prompts = 0;
  const session = load("src/lib/admin/session.ts", {}, { fetch: async (url) => {
    if (url === "/api/admin/login") { valid = true; return json({ ok: true }); }
    if (url === "/late" && !valid) return new Promise((resolve) => { finish = resolve; });
    return json({}, valid ? 200 : 401);
  } });
  const unsubscribe = session.subscribeAdminSession(() => { if (session.needsAdminSignIn()) prompts += 1; });
  const late = session.adminFetch("/late");
  const first = session.adminFetch("/first");
  await flush();
  await session.signInAdminAgain("password");
  await first;
  finish(json({}, 401));
  assert.equal((await late).ok, true);
  assert.equal(prompts, 1);
  unsubscribe();
});

test("only an existing valid login can renew its eight-hour cookie", async () => {
  const auth = load("src/lib/admin/auth.ts", {}, { process: { env: {
    NODE_ENV: "production", ADMIN_PASSWORD: "test-password", ADMIN_SESSION_SECRET: "test-secret",
  } } });
  const { POST } = load("src/app/api/admin/session/route.ts", { "@/lib/admin/auth": auth });
  for (const token of [null, "forged", auth.sessionToken()]) {
    const response = await POST(new Request("https://example.com/api/admin/session", {
      method: "POST", headers: { origin: "https://example.com", ...(token ? { cookie: `${auth.ADMIN_COOKIE}=${token}` } : {}) },
    }));
    const valid = token === auth.sessionToken();
    assert.equal(response.status, valid ? 200 : 401);
    assert.match(response.headers.get("cache-control"), /no-store/);
    if (valid) {
      const cookie = response.headers.get("set-cookie");
      assert.match(cookie, /Max-Age=28800/);
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /Secure/);
      assert.match(cookie, /SameSite=lax/i);
    } else assert.equal(response.headers.has("set-cookie"), false);
  }
  const rejected = await POST(new Request("https://example.com/api/admin/session", {
    method: "POST", headers: { origin: "https://other.example", cookie: `${auth.ADMIN_COOKIE}=${auth.sessionToken()}` },
  }));
  assert.equal(rejected.status, 403);
  assert.equal(rejected.headers.has("set-cookie"), false);
});

function draftWith(storage) {
  return load("src/lib/admin/packageDraft.ts", {}, { window: { sessionStorage: storage } });
}
function memoryStorage() {
  const items = new Map();
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), removeItem: (key) => items.delete(key) };
}

test("a package draft and original package ID survive reload and login navigation", () => {
  const storage = memoryStorage();
  const first = draftWith(storage);
  const draft = { editingId: "kashmir", draft: { id: "kashmir", title: "Vaishnodevi & Kashmir Paradise", price: "69,889", itinerary: [{ day: 1, title: "Arrival" }], gallery: [{ image: "/photo.jpg" }] } };
  first.packageDraftStore.set(draft);
  const reloaded = draftWith(storage);
  const unsubscribe = reloaded.packageDraftStore.subscribe(() => {});
  assert.deepEqual(JSON.parse(JSON.stringify(reloaded.packageDraftStore.getSnapshot())), draft);
  unsubscribe();
  reloaded.clearPackageEditorDraft();
  const afterSave = draftWith(storage);
  afterSave.packageDraftStore.subscribe(() => {});
  assert.equal(afterSave.packageDraftStore.getSnapshot(), null);
});

test("new-package drafts stay new after reload and intentional dismissal clears the backup", () => {
  const storage = memoryStorage();
  const first = draftWith(storage);
  first.packageDraftStore.set({ editingId: null, draft: { title: "New package", price: "62499" } });
  const reloaded = draftWith(storage);
  reloaded.packageDraftStore.subscribe(() => {});
  assert.equal(reloaded.packageDraftStore.getSnapshot().editingId, null);
  reloaded.packageDraftStore.set(null);
  const dismissed = draftWith(storage);
  dismissed.packageDraftStore.subscribe(() => {});
  assert.equal(dismissed.packageDraftStore.getSnapshot(), null);
});

test("broken or disabled browser storage does not crash the editor or discard its in-memory draft", () => {
  const broken = draftWith({ getItem: () => "{broken json" });
  broken.packageDraftStore.subscribe(() => {});
  assert.equal(broken.packageDraftStore.getSnapshot(), null);
  const disabled = draftWith({ getItem: () => { throw new Error("disabled"); }, setItem: () => { throw new Error("quota"); }, removeItem: () => { throw new Error("disabled"); } });
  disabled.packageDraftStore.subscribe(() => {});
  const draft = { editingId: null, draft: { title: "Still editing" } };
  disabled.packageDraftStore.set(draft);
  assert.equal(disabled.packageDraftStore.getSnapshot(), draft);
  disabled.clearPackageEditorDraft();
  assert.equal(disabled.packageDraftStore.getSnapshot(), null);
});
