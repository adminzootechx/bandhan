"use client";

const listeners = new Set<() => void>();
let pending: { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void } | null = null;
let loginVersion = 0;
let stopMonitor: (() => void) | null = null;

function emit() {
  listeners.forEach((listener) => listener());
}

export function needsAdminSignIn() {
  return pending !== null;
}

export function subscribeAdminSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) cancelAdminSignIn();
  };
}

function requestAdminSignIn(): Promise<void> {
  if (pending) return pending.promise;
  if (!listeners.size) {
    return Promise.reject(new Error("Your admin session has expired. Sign in again, then retry your changes."));
  }
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  pending = { promise, resolve, reject };
  emit();
  return promise;
}

export function cancelAdminSignIn() {
  const current = pending;
  pending = null;
  current?.reject(new Error("Sign-in cancelled. Your changes are still in the editor; sign in and try saving again."));
  emit();
}

export async function signInAdminAgain(password: string) {
  const current = pending;
  if (!current) return;
  const response = await fetch("/api/admin/login", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) throw new Error(data?.error || "Could not sign in. Please try again.");
  if (pending !== current) return;
  pending = null;
  loginVersion += 1;
  current.resolve();
  emit();
}

/** Retry only a rejected authentication check, after a successful admin login. */
export async function adminFetch(url: string, options?: RequestInit): Promise<Response> {
  const version = loginVersion;
  const send = () => fetch(url, { ...options, credentials: "same-origin" });
  const response = await send();
  options?.signal?.throwIfAborted();
  if (response.status !== 401) return response;
  if (version === loginVersion) await requestAdminSignIn();
  options?.signal?.throwIfAborted();
  return send();
}

/** Authenticate before sending image files, retaining the selected files during sign-in. */
export async function ensureAdminSession() {
  const response = await adminFetch("/api/admin/session", { method: "POST", cache: "no-store" });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "Could not verify your admin session. Please try again.");
  }
}

export function stopAdminSessionMonitor() {
  stopMonitor?.();
  stopMonitor = null;
}

/** Renew while an admin is using the panel; hidden and idle tabs do not keep a login alive. */
export function startAdminSessionMonitor() {
  stopAdminSessionMonitor();
  const interval = 5 * 60 * 1000;
  let lastActivity = Date.now();
  let lastAttempt = -Infinity;
  let busy = false;
  const controller = new AbortController();
  const renew = async () => {
    const now = Date.now();
    if (busy || controller.signal.aborted || document.visibilityState === "hidden" || now - lastActivity >= interval || now - lastAttempt < interval) return;
    busy = true;
    lastAttempt = now;
    try {
      await adminFetch("/api/admin/session", { method: "POST", cache: "no-store", signal: controller.signal });
    } catch {
      // A temporary network failure must not interrupt typing; Save has its own recovery.
    } finally {
      busy = false;
    }
  };
  const activity = () => { lastActivity = Date.now(); void renew(); };
  const visible = () => { if (document.visibilityState !== "hidden") activity(); };
  window.addEventListener("pointerdown", activity, { passive: true });
  window.addEventListener("keydown", activity);
  window.addEventListener("focus", activity);
  document.addEventListener("visibilitychange", visible);
  const timer = window.setInterval(() => void renew(), 60 * 1000);
  void renew();
  const stop = () => {
    controller.abort();
    window.clearInterval(timer);
    window.removeEventListener("pointerdown", activity);
    window.removeEventListener("keydown", activity);
    window.removeEventListener("focus", activity);
    document.removeEventListener("visibilitychange", visible);
  };
  stopMonitor = stop;
  return stop;
}
