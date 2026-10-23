import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, overrides = {}, globals = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
  const testModule = { exports: {} };
  vm.runInNewContext(outputText, { module: testModule, exports: testModule.exports,
    require: (name) => Object.hasOwn(overrides, name) ? overrides[name] : require(name),
    console, crypto: globalThis.crypto, URL, ...globals }, { filename: path });
  return testModule.exports;
}
const category = load("src/lib/packageCategory.ts");
const plain = (value) => JSON.parse(JSON.stringify(value));
const trip = { id: "kerala", title: "Kerala Trip", category: "Domestic", travelStyles: ["customized"], status: "active", createdAt: "2026-01-01T00:00:00Z", price: "₹19,999", itinerary: [{ day: 1, title: "Backwaters" }], gallery: [{ image: "/kerala.jpg" }] };

test("Group Tours accepts a category and overlapping group membership", () => {
  assert.equal(category.parseCategoryParam("Group Tours"), "group-tours");
  assert.equal(category.matchesPackageCategory({ ...trip, category: "Group Tours" }, "group-tours"), true);
  assert.equal(category.matchesPackageCategory({ ...trip, travelStyles: ["group"] }, "group-tours"), true);
});

test("adding an existing tour to Group Tours preserves its location, itinerary, prices and photos", () => {
  const patch = category.packageCategoryPatch(trip, "Group Tours", "add-group");
  const updated = { ...trip, ...patch };
  assert.equal(updated.category, "Domestic");
  assert.equal(updated.itinerary, trip.itinerary);
  assert.equal(updated.gallery, trip.gallery);
  assert.equal(updated.price, trip.price);
  assert.deepEqual(plain(updated.travelStyles), ["customized", "group"]);
  assert.deepEqual(plain(category.packageCategoryPatch(updated, "Group Tours", "add-group")), plain(patch));
});

test("moving into and out of Group Tours updates the public filter without inferred membership reappearing", () => {
  const grouped = { ...trip, ...category.packageCategoryPatch(trip, "Group Tours", "move") };
  assert.equal(grouped.category, "Group Tours");
  assert.equal(category.matchesPackageCategory(grouped, "group-tours"), true);
  const moved = { ...grouped, title: "Kerala Group Tour", ...category.packageCategoryPatch(grouped, "International", "move") };
  assert.equal(category.matchesPackageCategory(moved, "group-tours"), false);
  assert.equal(category.matchesPackageCategory(moved, "international"), true);
  assert.throws(() => category.packageCategoryPatch(trip, "Unknown", "move"));
});

test("new active tours lead the homepage and drafts stay hidden", () => {
  const old = Array.from({ length: 8 }, (_, index) => ({ ...trip, id: `old-${index}` }));
  const fresh = { ...trip, id: "new-client-tour", createdAt: "2026-10-13T00:00:00Z" };
  const draft = { ...fresh, id: "draft", status: "draft" };
  const visible = category.homepagePackages([...old, fresh, draft], "all");
  assert.equal(visible.length, 6);
  assert.equal(visible[0].id, fresh.id);
  assert.equal(visible.some((item) => item.id === draft.id), false);
  assert.equal(old[0].id, "old-0");
});

test("the default curated homepage selection excludes group tours while destination tabs include them", () => {
  const groups = [
    { ...trip, id: "group-category", category: "Group Tours" },
    { ...trip, id: "group-style", travelStyles: ["group"] },
    { ...trip, id: "group-and-custom", travelStyles: ["group", "customized"] },
    { ...trip, id: "legacy-group", travelStyles: undefined, groupSize: "Group departures" },
  ].map((pkg) => ({ ...pkg, createdAt: "2026-10-20T00:00:00Z" }));
  const privateTrips = Array.from({ length: 7 }, (_, index) => ({ ...trip, id: `private-${index}` }));
  const international = { ...trip, id: "international", category: "International" };
  const northEast = { ...trip, id: "north-east", category: "North East" };
  const draft = { ...trip, id: "draft", status: "draft" };
  const packages = [...groups, ...privateTrips, international, northEast, draft];
  const groupIds = new Set(category.homepagePackages(packages, "group-tours").map((pkg) => pkg.id));
  assert.equal(groupIds.size, groups.length);
  const curated = category.homepageCuratedPackages(packages, "all");
  assert.equal(curated.some((pkg) => groupIds.has(pkg.id) || pkg.status === "draft"), false);
  assert.equal(category.homepageCuratedPackages(packages, "all").length, 6);
  assert.deepEqual(plain(category.homepageCuratedPackages(packages, "international").map((pkg) => pkg.id)), [international.id]);
  assert.deepEqual(plain(category.homepageCuratedPackages(packages, "north-east").map((pkg) => pkg.id)), [northEast.id]);
  assert.equal(category.homepageCuratedPackages(groups, "all").length, 0);
});

test("North East and other destination tabs show published group tours without exposing drafts", () => {
  const northEast = { ...trip, id: "three-sisters", category: "North East", travelStyles: ["group"] };
  const international = { ...trip, id: "japan-group", category: "International", travelStyles: ["group", "customized"] };
  const domestic = { ...trip, id: "ayodhya-group", travelStyles: ["group"] };
  const draft = { ...northEast, id: "draft-northeast", status: "draft" };
  const packages = [northEast, international, domestic, draft];
  assert.equal(category.homepageCuratedPackages(packages, "all").length, 0);
  assert.deepEqual(plain(category.homepageCuratedPackages(packages, "north-east").map((pkg) => pkg.id)), [northEast.id]);
  assert.deepEqual(plain(category.homepageCuratedPackages(packages, "international").map((pkg) => pkg.id)), [international.id]);
  assert.deepEqual(plain(category.homepageCuratedPackages(packages, "domestic").map((pkg) => pkg.id)), [domestic.id]);
});

test("homepage journey filters change cards in place, filter before the cutoff, and expand without navigation", () => {
  const React = require("react");
  let items = [
    ...Array.from({ length: 8 }, (_, index) => ({ ...trip, id: `custom-${index}`, createdAt: "2026-10-20" })),
    { ...trip, id: "group", travelStyles: ["group"] },
    { ...trip, id: "seasonal", travelStyles: ["seasonal"] },
    { ...trip, id: "special", travelStyles: ["special-departure"] },
    { ...trip, id: "draft", travelStyles: ["group", "seasonal"], status: "draft", createdAt: "2026-10-22" },
  ];
  const state = [];
  let cursor = 0;
  const passthrough = ({ children }) => children;
  const PackageCard = () => null;
  const { default: GroupDepartures } = load("src/components/home/GroupDepartures.tsx", {
    react: { ...React, useEffect: () => {}, useState: (initial) => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (value) => { state[index] = typeof value === "function" ? value(state[index]) : value; }];
    } },
    "@/lib/admin/store": { useCollection: () => ({ ready: true, items }) },
    "@/lib/packageCategory": category,
    "@/lib/departures/types": load("src/lib/departures/types.ts"),
    "@/lib/priceLabel": load("src/lib/priceLabel.ts"),
    "@/components/home/FeaturedPackages": { PackageCard },
    "@/components/ui/SiteImage": () => null,
    "@/components/ui/Container": { Container: passthrough },
    "@/components/ui/SectionTitle": { SectionTitle: () => null },
    "@/components/ui/PrimaryButton": { PrimaryButton: () => null },
    "@/components/ui/Stagger": { Stagger: passthrough, StaggerItem: passthrough },
    "@/components/packages/BookingModal": () => null,
    "next/link": () => { throw new Error("Homepage filters must not navigate"); },
    "next/navigation": { useRouter: () => { throw new Error("Homepage filters must not navigate"); } },
  });
  const flatten = (node) => !node ? [] : Array.isArray(node) ? node.flatMap(flatten) : typeof node === "object" ? [node, ...flatten(node.props?.children)] : [];
  const render = () => { cursor = 0; return flatten(GroupDepartures()); };
  const cards = (nodes) => nodes.filter((node) => node.type === PackageCard).map((node) => node.props.pkg.id);
  const button = (nodes, label) => nodes.find((node) => node.type === "button" && flatten(node.props.children).length === 0 && node.props.children === label);
  let nodes = render();
  assert.deepEqual(plain(cards(nodes)), ["group"], "a group tour beyond the initial six published records still appears");
  for (const [label, expected] of [["Customizable", "custom-0"], ["Seasonal", "seasonal"], ["Special departures", "special"], ["Group tours", "group"]]) {
    button(nodes, label).props.onClick();
    nodes = render();
    assert.equal(button(nodes, label).props["aria-pressed"], true);
    assert.equal(cards(nodes)[0], expected);
    assert.equal(cards(nodes).includes("draft"), false);
  }
  button(nodes, "Every journey").props.onClick();
  nodes = render();
  assert.equal(cards(nodes).length, 6);
  nodes.find((node) => node.type === "button" && Array.isArray(node.props.children) && node.props.children[0] === "Show more tours ").props.onClick();
  nodes = render();
  assert.equal(cards(nodes).length, 11);
  button(nodes, "Seasonal").props.onClick();
  items = items.filter((pkg) => pkg.id !== "seasonal");
  nodes = render();
  assert.equal(cards(nodes).length, 0);
  button(nodes, "Show every journey").props.onClick();
  nodes = render();
  assert.equal(cards(nodes).length, 6, "changing styles resets the visible count");
  assert.equal(button(nodes, "Every journey").props["aria-pressed"], true);
});

function storeWith(fetch, channelType, clock = { now: Date.now() }) {
  const window = new EventTarget();
  const document = Object.assign(new EventTarget(), { visibilityState: "visible" });
  const store = load("src/lib/admin/store.ts", {
    "./session": { adminFetch: fetch },
    "@/lib/content/seeds": { seedForCollection: () => [trip] },
    react: { useCallback: (fn) => fn, useSyncExternalStore: () => {} },
  }, { fetch, window, document, BroadcastChannel: channelType, Date: { now: () => clock.now }, console: { error: () => {} } });
  return { ...store, window, document, clock };
}
const json = (data) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });

test("an in-flight pre-save response cannot remove a newly published tour", async () => {
  let finishOld;
  let gets = 0;
  const fresh = { ...trip, id: "new-tour" };
  const state = storeWith(async (_, options) => {
    if (options.method === "POST") return json({ ok: true, item: fresh });
    gets += 1;
    return gets === 1 ? new Promise((resolve) => { finishOld = resolve; }) : json({ items: [trip, fresh] });
  });
  const pending = state.refreshCollection("packages");
  await state.store.add("packages", fresh);
  finishOld(json({ items: [trip] }));
  await pending;
  assert.equal(state.store.read("packages").some((item) => item.id === fresh.id), true);
});

test("a successful save stays visible when the following refresh fails", async () => {
  const fresh = { ...trip, id: "saved-tour" };
  const state = storeWith(async (_, options) => {
    if (options.method === "POST") return json({ ok: true, item: fresh });
    throw new Error("Network interrupted after the save");
  });
  await state.store.add("packages", fresh);
  assert.equal(state.store.read("packages").some((item) => item.id === fresh.id), true);
});

test("returning to an open website tab refreshes shared published content", async () => {
  let gets = 0;
  const fresh = { ...trip, id: "another-tab-tour" };
  const state = storeWith(async () => json({ items: ++gets === 1 ? [trip] : [trip, fresh] }));
  const stop = state.subscribeToCollection("packages", () => {});
  await state.refreshCollection("packages");
  state.clock.now += 5 * 60 * 1000;
  state.window.dispatchEvent(new Event("focus"));
  await state.refreshCollection("packages");
  assert.equal(state.store.read("packages").some((item) => item.id === fresh.id), true);
  stop();
});

test("mounted components, route revisits and focus events reuse a recent public read", async () => {
  const requests = [];
  const state = storeWith(async (_, options) => { requests.push(options); return json({ items: [trip] }); });
  const stop = state.subscribeToCollection("packages", () => {});
  await state.refreshCollection("packages");
  const stopAnother = state.subscribeToCollection("packages", () => {});
  state.window.dispatchEvent(new Event("focus"));
  state.document.dispatchEvent(new Event("visibilitychange"));
  await state.refreshCollection("packages");
  assert.equal(requests.length, 1);
  assert.equal(requests[0].credentials, "omit");
  stop(); stopAnother();
});

test("an admin edit uses the returned record without downloading the catalogue again", async () => {
  let gets = 0;
  const state = storeWith(async (_, options) => {
    if (options.method === "PATCH") return json({ item: { ...trip, title: "Saved title" } });
    if (options.method === "DELETE") return json({ removed: true });
    gets += 1; return json({ items: [trip] });
  });
  state.window.location = { pathname: "/admin/packages" };
  await state.refreshCollection("packages");
  await state.store.update("packages", trip.id, { title: "Saved title" });
  assert.equal(state.store.read("packages")[0].title, "Saved title");
  await state.store.remove("packages", trip.id);
  assert.equal(state.store.read("packages").length, 0);
  assert.equal(gets, 1);
});

test("admin drafts stay separate from the public browser snapshot", async () => {
  const draft = { ...trip, id: "draft", status: "draft" };
  const state = storeWith(async (_, options) => json({ items: options.credentials === "omit" ? [trip] : [trip, draft] }));
  state.window.location = { pathname: "/admin/packages" };
  await state.refreshCollection("packages");
  assert.equal(state.store.read("packages").length, 2);
  state.window.location.pathname = "/packages";
  await state.refreshCollection("packages");
  assert.equal(state.store.read("packages").length, 1);
  state.window.location.pathname = "/admin/packages";
  await state.refreshCollection("packages");
  assert.equal(state.store.read("packages").length, 2);
});

test("repeated focus events during an outage back off and retain the last loaded catalogue", async () => {
  let gets = 0;
  const state = storeWith(async () => {
    if (++gets > 1) throw new Error("Quota exceeded");
    return json({ items: [trip, { ...trip, id: "gujarat" }] });
  });
  const stop = state.subscribeToCollection("packages", () => {});
  await state.refreshCollection("packages");
  state.clock.now += 5 * 60 * 1000;
  await state.refreshCollection("packages");
  state.window.dispatchEvent(new Event("focus"));
  await state.refreshCollection("packages");
  assert.equal(gets, 2);
  assert.equal(state.store.read("packages").length, 2);
  state.clock.now += 30 * 1000;
  await state.refreshCollection("packages");
  assert.equal(gets, 3);
  stop();
});

test("the idle chatbot and unused blog search do not subscribe to their collections", () => {
  const callbacks = [];
  let requests = 0;
  const state = load("src/lib/admin/store.ts", {
    "./session": {}, "@/lib/content/seeds": { seedForCollection: () => [trip] },
    react: { useCallback: (fn) => fn, useSyncExternalStore: (subscribe) => { callbacks.push(subscribe); return [trip]; } },
  }, { window: new EventTarget(), fetch: () => { requests += 1; } });
  state.useCollection("blog", { enabled: false });
  callbacks[0](() => {})();
  assert.equal(requests, 0);
});

test("a save notification from another tab replaces an older pending read", async () => {
  const channels = [];
  class Channel {
    constructor() { channels.push(this); }
    close() {}
  }
  let finishOld;
  let gets = 0;
  const fresh = { ...trip, id: "published-elsewhere" };
  const state = storeWith(async () => ++gets === 1
    ? new Promise((resolve) => { finishOld = resolve; })
    : json({ items: [trip, fresh] }), Channel);
  const stop = state.subscribeToCollection("packages", () => {});
  const oldRequest = state.refreshCollection("packages");
  channels[0].onmessage({ data: { key: "packages" } });
  await state.refreshCollection("packages");
  finishOld(json({ items: [trip] }));
  await oldRequest;
  assert.equal(state.store.read("packages").some((item) => item.id === fresh.id), true);
  stop();
});

test("SQL fetches request fresh content rather than replaying cached responses", async () => {
  const neonConfig = {};
  let requestedCache;
  load("src/lib/db.ts", { "@neondatabase/serverless": { neon: () => {}, neonConfig } }, {
    fetch: async (_, init) => { requestedCache = init.cache; return json({}); },
  });
  await neonConfig.fetchFunction("https://database.example/query", { method: "POST" });
  assert.equal(requestedCache, "no-store");
});

test("package URLs resolve newly created live tours outside the bundled catalogue", async () => {
  const fresh = { ...trip, id: "client-created-tour" };
  const packages = load("src/lib/content/packages.ts", {
    "server-only": {}, react: { cache: (fn) => fn },
    "@/data/mockData": { featuredPackages: [trip] },
    "@/lib/db": { isDbConfigured: () => true },
    "./cache": { listCachedPublicContent: async () => [trip, fresh] },
  });
  assert.equal((await packages.getPublishedPackage(fresh.id)).id, fresh.id);
  assert.equal(await packages.getPublishedPackage("missing"), null);
});

test("public reads share a cache, admin reads bypass it, and publish/unpublish/delete expire it", async () => {
  const draft = { ...trip, id: "new-tour", status: "draft" };
  let records = [trip, draft];
  let publicReads = 0;
  let adminReads = 0;
  const entries = new Map();
  const expirations = [];
  const environment = { env: { DATABASE_URL: "postgresql://example.invalid/first" } };
  const cacheApi = {
    unstable_cache: (read, keys, options) => async () => {
      const key = JSON.stringify(keys);
      if (!entries.has(key)) entries.set(key, { items: await read(), tags: options.tags });
      assert.equal(options.revalidate, 3600);
      return entries.get(key).items;
    },
    revalidateTag: (tag, profile) => {
      expirations.push(profile);
      for (const [key, entry] of entries) if (entry.tags.includes(tag)) entries.delete(key);
    },
  };
  const database = {
    isCollectionKey: (key) => ["packages", "enquiries"].includes(key),
    listPublicContent: async () => { publicReads += 1; return records.filter((item) => item.status !== "draft"); },
    listContent: async () => { adminReads += 1; return records; },
    createContentItem: async (_, item) => { records = [...records, item]; return item; },
    updateContentItem: async (_, id, patch) => {
      records = records.map((item) => item.id === id ? { ...item, ...patch } : item);
      return records.find((item) => item.id === id) || null;
    },
    deleteContentItem: async (_, id) => { records = records.filter((item) => item.id !== id); return true; },
  };
  const cached = load("src/lib/content/cache.ts", {
    "server-only": {}, "next/cache": cacheApi, "./db": database,
  }, { process: environment });
  const route = load("src/app/api/content/[collection]/route.ts", {
    "next/server": { NextResponse: { json: (data, init) => new Response(JSON.stringify(data), init) } },
    "@/lib/db": { isDbConfigured: () => true },
    "@/lib/admin/auth": { requireAdmin: (request) => request.headers.has("cookie") },
    "@/lib/packageDates": load("src/lib/packageDates.ts"),
    "@/lib/content/db": database, "@/lib/content/cache": cached,
  });
  const context = { params: Promise.resolve({ collection: "packages" }) };
  const request = (method = "GET", body, admin = false) => new Request("https://example.test/api/content/packages", {
    method, headers: { ...(admin ? { cookie: "session=admin" } : {}), "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const get = async (admin = false) => (await (await route.GET(request("GET", undefined, admin), context)).json()).items;
  assert.equal((await get()).length, 1);
  await cached.listCachedPublicContent("packages"); // A page/brochure uses the same cache as JSON.
  await get();
  assert.equal(publicReads, 1);
  assert.equal((await get(true)).length, 2);
  await get(true);
  assert.equal(adminReads, 2);
  await route.PATCH(request("PATCH", { id: draft.id, patch: { status: "active" } }, true), context);
  assert.equal((await get()).length, 2);
  assert.equal(publicReads, 2);
  await route.PATCH(request("PATCH", { id: draft.id, patch: { status: "draft" } }, true), context);
  assert.equal((await get()).length, 1);
  await route.POST(request("POST", { ...trip, id: "created" }, true), context);
  assert.equal((await get()).length, 2);
  await route.DELETE(new Request("https://example.test/api/content/packages?id=created", { method: "DELETE", headers: { cookie: "session=admin" } }), context);
  assert.equal((await get()).length, 1);
  assert.equal(expirations.length, 4);
  assert.ok(expirations.every((profile) => profile.expire === 0));
  const beforeMigration = publicReads;
  environment.env.DATABASE_URL = "postgresql://example.invalid/second";
  await get();
  assert.equal(publicReads, beforeMigration + 1, "a migrated database must have its own cache");
  assert.equal((await route.GET(request(), { params: Promise.resolve({ collection: "enquiries" }) })).status, 401);
});

test("collection seeding runs once per warm process and retries failed initialization", async () => {
  let seeds = 0;
  let reads = 0;
  let failSeed = true;
  const database = load("src/lib/content/db.ts", {
    "server-only": {}, "./seeds": { seedForCollection: () => [trip] },
    "@/lib/db": { getSql: () => async (parts) => {
      if (parts.join("").includes("INSERT INTO")) {
        seeds += 1;
        if (failSeed) throw new Error("offline");
        return [];
      }
      reads += 1;
      return [{ data: trip, created_at: "2026-01-01", updated_at: "2026-01-01" }];
    } },
  });
  await assert.rejects(database.listContent("packages"));
  failSeed = false;
  await Promise.all([database.listContent("packages"), database.listContent("packages")]);
  await database.listContent("packages");
  assert.equal(seeds, 2, "one failed attempt plus one successful initialization");
  assert.equal(reads, 3);
});

test("the admin renders group-tour creation, draft publishing and category-moving controls", () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { default: Manager } = load("src/components/admin/TourPackageManager.tsx", {
    "@/lib/admin/store": { store: {}, useCollection: () => ({ ready: true, items: [{ ...trip, status: "draft" }] }) },
    "@/lib/packageCategory": category,
    "./PageHeader": (props) => React.createElement("header", null, props.title, props.action),
    "@/components/ui/PrimaryButton": { PrimaryButton: (props) => React.createElement("button", { type: props.type, disabled: props.disabled, onClick: props.onClick }, props.children) },
    "./ResourceManager": { Thumb: () => null },
    "./MediaPicker": () => null, "./TourPackagePreview": () => null,
    "./TourDatesEditor": () => null,
    "@/lib/packageDates": load("src/lib/packageDates.ts"),
    "@/lib/priceLabel": load("src/lib/priceLabel.ts"),
    "@/lib/admin/packageDraft": { usePackageEditorDraft: () => [null, () => {}] },
  });
  const html = renderToStaticMarkup(React.createElement(Manager));
  assert.match(html, /New group tour/);
  assert.match(html, /Add to Group Tours/);
  assert.match(html, /Move to category/);
  assert.match(html, />Publish<\/button>/);
});
