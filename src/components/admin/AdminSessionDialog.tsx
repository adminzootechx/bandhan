"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { cancelAdminSignIn, needsAdminSignIn, signInAdminAgain, subscribeAdminSession } from "@/lib/admin/session";

function SignInForm() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await signInAdminAgain(password);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sign in. Please try again.");
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialog} aria-labelledby="admin-session-title" aria-describedby="admin-session-description" onCancel={(event) => { event.preventDefault(); if (!busy) cancelAdminSignIn(); }} className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-primary shadow-2xl backdrop:bg-primary/65 backdrop:backdrop-blur-sm sm:p-8">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-accent">Admin session</p>
      <h2 id="admin-session-title" className="mt-2 font-heading text-2xl font-bold">Sign in to continue</h2>
      <p id="admin-session-description" className="mt-3 text-sm leading-6 text-foreground-muted">Your session has expired or you were signed out. Your edits are still here. Enter your admin password to continue saving or uploading.</p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="admin-session-password" className="text-xs font-semibold uppercase tracking-wide">Admin password</label>
          <input id="admin-session-password" name="password" type="password" autoComplete="current-password" required autoFocus disabled={busy} value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-accent" />
        </div>
        {error && <p role="alert" className="rounded-xl border border-accent/20 bg-accent/5 p-3 text-sm text-accent-dark">{error}</p>}
        <PrimaryButton type="submit" variant="navy" fullWidth isLoading={busy}>Sign in & continue</PrimaryButton>
        <button type="button" disabled={busy} onClick={cancelAdminSignIn} className="w-full py-2 text-xs font-semibold text-foreground-muted disabled:opacity-50">Keep editing</button>
      </form>
    </dialog>
  );
}

export default function AdminSessionDialog() {
  const required = useSyncExternalStore(subscribeAdminSession, needsAdminSignIn, () => false);
  return required ? <SignInForm /> : null;
}
