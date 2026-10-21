"use client";

import { useSyncExternalStore } from "react";
import type { TourPackage } from "@/data/mockData";

interface PackageEditorDraft {
  editingId: string | null;
  draft: TourPackage;
}

const STORAGE_KEY = "bandhan:admin:package-draft:v1";
const listeners = new Set<() => void>();
let snapshot: PackageEditorDraft | null = null;
let loaded = false;

function hydrate() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || "null");
    if (stored?.version === 1 && typeof stored.value?.draft?.title === "string" && (stored.value.editingId === null || typeof stored.value.editingId === "string")) {
      snapshot = stored.value;
    }
  } catch {
    // Browsers with disabled storage still keep the open editor in memory.
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  hydrate();
  listener();
  return () => { listeners.delete(listener); };
}

function setDraft(update: PackageEditorDraft | null | ((current: PackageEditorDraft | null) => PackageEditorDraft | null)) {
  hydrate();
  snapshot = typeof update === "function" ? update(snapshot) : update;
  try {
    if (snapshot) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, value: snapshot }));
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Retain the in-memory draft if browser storage is unavailable or full.
  }
  listeners.forEach((listener) => listener());
}

export function clearPackageEditorDraft() {
  setDraft(null);
}

export const packageDraftStore = { subscribe, getSnapshot: () => snapshot, set: setDraft };

/** Same-tab backup survives a reload or a trip through the admin login page. */
export function usePackageEditorDraft() {
  const value = useSyncExternalStore(subscribe, packageDraftStore.getSnapshot, () => null);
  return [value, setDraft] as const;
}
