"use client";

import { useCallback, useSyncExternalStore } from "react";
import { seedForCollection } from "@/lib/content/seeds";
import type { CollectionKey, Enquiry, WithId } from "./types";
import { adminFetch } from "./session";

const listeners = new Map<CollectionKey, Set<() => void>>();
type Scope = "public" | "admin";
type SnapshotKey = `${Scope}:${CollectionKey}`;
const snapshots = new Map<SnapshotKey, WithId[]>();
const readyCollections = new Set<SnapshotKey>();
const inFlight = new Map<SnapshotKey, Promise<void>>();
const versions = new Map<SnapshotKey, number>();
const fetchedAt = new Map<SnapshotKey, number>();
const retryAfter = new Map<SnapshotKey, number>();
const PUBLIC_FRESH_MS = 5 * 60 * 1000;
const ADMIN_FRESH_MS = 30 * 1000;
let updatesChannel: BroadcastChannel | null = null;
let watching = false;

function currentScope(): Scope {
  return typeof window !== "undefined" && /^\/admin(?:\/|$)/.test(window.location?.pathname || "") ? "admin" : "public";
}

function snapshotKey(key: CollectionKey, scope = currentScope()): SnapshotKey {
  return `${scope}:${key}`;
}

function invalidateCollection(key: CollectionKey) {
  for (const scope of ["public", "admin"] as const) {
    const scoped = snapshotKey(key, scope);
    versions.set(scoped, (versions.get(scoped) || 0) + 1);
    inFlight.delete(scoped);
    fetchedAt.delete(scoped);
    retryAfter.delete(scoped);
  }
}

function refreshVisibleCollections() {
  if (document.visibilityState === "hidden") return;
  for (const [key, callbacks] of listeners) {
    if (callbacks.size) void refreshCollection(key);
  }
}

function watchChanges() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  window.addEventListener("focus", refreshVisibleCollections);
  document.addEventListener("visibilitychange", refreshVisibleCollections);
  if (typeof BroadcastChannel !== "undefined") {
    updatesChannel = new BroadcastChannel("bandhan-content-updates");
    updatesChannel.onmessage = (event: MessageEvent<{ key?: CollectionKey }>) => {
      const key = event.data?.key;
      if (key) {
        invalidateCollection(key);
        if (listeners.get(key)?.size) void refreshCollection(key);
      }
    };
  }
}

function emit(key: CollectionKey) {
  listeners.get(key)?.forEach((callback) => callback());
}

function getSnapshot<T extends WithId>(key: CollectionKey, scope = currentScope()): T[] {
  return (snapshots.get(snapshotKey(key, scope)) || seedForCollection(key)) as T[];
}

async function readError(response: Response, fallback: string) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error || fallback;
}

export async function refreshCollection(key: CollectionKey, options: { force?: boolean; scope?: Scope } = {}): Promise<void> {
  const scope = options.scope ?? currentScope();
  const scoped = snapshotKey(key, scope);
  const existing = inFlight.get(scoped);
  if (existing) return existing;
  const now = Date.now();
  const ttl = scope === "admin" ? ADMIN_FRESH_MS : PUBLIC_FRESH_MS;
  const lastFetched = fetchedAt.get(scoped);
  if (!options.force && ((lastFetched !== undefined && now - lastFetched < ttl) || now < (retryAfter.get(scoped) || 0))) return;
  const version = versions.get(scoped) || 0;
  // A public page must not bypass the shared server cache just because its visitor is an admin.
  const send = scope === "admin" ? adminFetch : fetch;
  const request = send(`/api/content/${key}`, { cache: "no-store", credentials: scope === "admin" ? "same-origin" : "omit" })
    .then(async (response) => {
      if (!response.ok) throw new Error(await readError(response, "Could not load content."));
      const data = (await response.json()) as { items?: WithId[] };
      if ((versions.get(scoped) || 0) !== version) return;
      snapshots.set(scoped, data.items || []);
      fetchedAt.set(scoped, Date.now());
      retryAfter.delete(scoped);
      readyCollections.add(scoped);
      emit(key);
    })
    .catch((error) => {
      if ((versions.get(scoped) || 0) !== version) return;
      // Public pages keep their bundled catalogue if the database is down.
      // Admin mutations still surface the actual error to the editor.
      console.error(`refresh ${key} error:`, error);
      // A new array reference makes useSyncExternalStore re-render, so
      // components waiting on `ready` see the load finish.
      if (!snapshots.has(scoped)) snapshots.set(scoped, [...seedForCollection(key)]);
      retryAfter.set(scoped, Date.now() + 30 * 1000);
      readyCollections.add(scoped);
      emit(key);
    })
    .finally(() => {
      if (inFlight.get(scoped) === request) inFlight.delete(scoped);
    });
  inFlight.set(scoped, request);
  return request;
}

export function subscribeToCollection(key: CollectionKey, callback: () => void, scope = currentScope()) {
  watchChanges();
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(callback);
  // Components and route revisits reuse a recent read; expired content refreshes on demand.
  void refreshCollection(key, { scope });
  return () => {
    listeners.get(key)?.delete(callback);
    if ([...listeners.values()].every((callbacks) => callbacks.size === 0) && watching) {
      window.removeEventListener("focus", refreshVisibleCollections);
      document.removeEventListener("visibilitychange", refreshVisibleCollections);
      updatesChannel?.close();
      updatesChannel = null;
      watching = false;
    }
  };
}

async function mutate(
  key: CollectionKey,
  method: "POST" | "PATCH" | "DELETE",
  body?: Record<string, unknown>,
  id?: string
) {
  const scope = currentScope();
  const response = await adminFetch(
    `/api/content/${key}${method === "DELETE" ? `?id=${encodeURIComponent(id || "")}` : ""}`,
    {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }
  );
  if (!response.ok) throw new Error(await readError(response, "Could not save content."));
  const result = (await response.json()) as { item?: WithId; removed?: boolean };
  // A GET started before this save must never overwrite the saved item afterwards.
  const scoped = snapshotKey(key, scope);
  const hadSnapshot = fetchedAt.has(scoped);
  invalidateCollection(key);
  const current = getSnapshot(key, scope);
  if (result.item) {
    const item = result.item;
    snapshots.set(scoped, current.some((value) => value.id === item.id)
      ? current.map((value) => value.id === item.id ? item : value)
      : [...current, item]);
  } else if (method === "DELETE" && result.removed) {
    snapshots.set(scoped, current.filter((item) => item.id !== id));
  }
  readyCollections.add(scoped);
  fetchedAt.set(scoped, Date.now());
  emit(key);
  updatesChannel?.postMessage({ key });
  // POST/PATCH return the complete saved record; DELETE confirms the removal.
  // Refetching the entire collection here doubles transfer for every edit.
  // If Save raced the initial load, fetch once to recover the remaining records.
  if (!hadSnapshot && currentScope() === scope) await refreshCollection(key, { force: true });
  return result;
}

function genId() {
  return crypto.randomUUID?.() || `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const store = {
  read<T extends WithId = WithId>(key: CollectionKey): T[] {
    return getSnapshot<T>(key);
  },
  async add(key: CollectionKey, item: Record<string, unknown> & { id?: string }) {
    const created = { ...item, id: item.id || genId() };
    await mutate(key, "POST", created);
    return created as WithId;
  },
  async update<T extends WithId = WithId>(key: CollectionKey, id: string, patch: Partial<T>) {
    await mutate(key, "PATCH", { id, patch: patch as Record<string, unknown> });
  },
  async remove(key: CollectionKey, id: string) {
    await mutate(key, "DELETE", undefined, id);
  },
};

export async function submitEnquiry(input: Omit<Enquiry, "id" | "status" | "createdAt">) {
  const response = await fetch("/api/enquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(await readError(response, "Could not submit your enquiry."));
  return response.json();
}

export function useCollection<T extends WithId = WithId>(key: CollectionKey, options: { enabled?: boolean } = {}): {
  items: T[];
  ready: boolean;
} {
  const scope = currentScope();
  const enabled = options.enabled !== false;
  const subscribe = useCallback((callback: () => void) => enabled ? subscribeToCollection(key, callback, scope) : () => {}, [key, scope, enabled]);
  const items = useSyncExternalStore<T[]>(
    subscribe,
    () => getSnapshot<T>(key, scope),
    () => seedForCollection<T>(key)
  );
  return { items, ready: readyCollections.has(snapshotKey(key, scope)) };
}
