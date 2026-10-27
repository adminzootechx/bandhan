"use client";

import React, { useEffect, useState } from "react";
import PageHeader from "@/components/admin/PageHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import type { GroupDeparture, DepartureStatus } from "@/lib/departures/types";
import { adminFetch } from "@/lib/admin/session";

const emptyForm = {
  destination: "",
  date: "",
  duration: "",
  price: "",
  totalSeats: "20",
  seatsLeft: "20",
  status: "guaranteed" as DepartureStatus,
};

const STATUS_OPTIONS: { value: DepartureStatus; label: string }[] = [
  { value: "filling-fast", label: "Filling Fast" },
  { value: "limited-seats", label: "Limited Seats" },
  { value: "guaranteed", label: "Guaranteed" },
  { value: "sold-out", label: "Sold Out" },
];

export default function AdminDeparturesPage() {
  const [departures, setDepartures] = useState<GroupDeparture[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    adminFetch("/api/admin/departures", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not load departures.");
        setDepartures(data.departures || []);
      })
      .catch((loadError) => setListError(loadError instanceof Error ? loadError.message : "Could not load departures."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const fallbackError = editingId ? "Could not save the departure." : "Could not create the departure.";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await adminFetch(editingId ? `/api/admin/departures/${editingId}` : "/api/admin/departures", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        setError(data.error || fallbackError);
        return;
      }
      setForm(emptyForm);
      setEditingId(null);
      refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : fallbackError);
    } finally {
      setBusy(false);
    }
  };

  /** Loads a departure into the form above so its date, seats and details can be changed. */
  const startEdit = (departure: GroupDeparture) => {
    setError("");
    setEditingId(departure.id);
    setForm({
      destination: departure.destination,
      date: departure.date,
      duration: departure.duration || "",
      price: departure.price || "",
      totalSeats: String(departure.total_seats),
      seatsLeft: String(departure.seats_left),
      status: departure.status,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setError("");
    setEditingId(null);
    setForm(emptyForm);
  };

  /** Sends a change for one departure, then reloads the list; a failure is shown on that departure's row. */
  const send = async (id: string, init: RequestInit, fallback: string) => {
    setRowError(null);
    setWorkingId(id);
    let ok = false;
    try {
      const res = await adminFetch(`/api/admin/departures/${id}`, init);
      const data = await res.json().catch(() => ({}));
      ok = res.ok && data.ok !== false;
      if (!ok) setRowError({ id, message: data.error || fallback });
    } catch (sendError) {
      setRowError({ id, message: sendError instanceof Error ? sendError.message : fallback });
    }
    setWorkingId(null);
    refresh();
    return ok;
  };

  const toggleActive = (departure: GroupDeparture) =>
    send(
      departure.id,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !departure.is_active }) },
      "Could not update the departure."
    );

  // Confirmed inline rather than with window.confirm, which the browser can silently suppress.
  const remove = async (id: string) => {
    setConfirmingId(null);
    const removed = await send(id, { method: "DELETE" }, "Could not delete the departure.");
    if (removed && editingId === id) cancelEdit();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departures"
        description="Manage upcoming group departure dates and seat availability. Seats decrement automatically as bookings are confirmed."
      />

      <div className="bg-white rounded-2xl border border-slate-100 p-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-primary mb-4">{editingId ? "Edit Departure" : "New Departure"}</h2>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input
            name="destination"
            required
            value={form.destination}
            onChange={handleChange}
            placeholder="Destination / title"
            className="sm:col-span-2 px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
          />
          <input
            name="date"
            required
            value={form.date}
            onChange={handleChange}
            placeholder="Departure date, e.g. Aug 15, 2026"
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
          />
          <input
            name="duration"
            value={form.duration}
            onChange={handleChange}
            placeholder="Duration, e.g. 7 Nights / 8 Days"
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
          />
          <input
            name="price"
            value={form.price}
            onChange={handleChange}
            placeholder="Price, e.g. 42500/-*"
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
          />
          <select
            name="status"
            value={form.status}
            onChange={handleChange}
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            name="totalSeats"
            type="number"
            min={1}
            required
            value={form.totalSeats}
            onChange={handleChange}
            placeholder="Total seats"
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
          />
          <input
            name="seatsLeft"
            type="number"
            min={0}
            value={form.seatsLeft}
            onChange={handleChange}
            placeholder="Seats left"
            className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
          />
          {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
          <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
            <PrimaryButton type="submit" variant="navy" size="md" isLoading={busy}>
              {editingId ? "Save Changes" : "Create Departure"}
            </PrimaryButton>
            {editingId && (
              <SecondaryButton type="button" size="md" variant="ghost" onClick={cancelEdit}>
                Cancel
              </SecondaryButton>
            )}
          </div>
        </form>
      </div>

      {listError && (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{listError}</p>
      )}

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden overflow-x-auto">
        {loading ? (
          <p className="p-6 text-sm text-foreground-muted">Loading…</p>
        ) : departures.length === 0 ? (
          <p className="p-6 text-sm text-foreground-muted">No departures yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-foreground-muted">
              <tr>
                <th className="px-4 py-3">Destination</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Seats</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Visible</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {departures.map((d) => (
                <tr key={d.id} className={`border-t border-slate-100 ${editingId === d.id ? "bg-accent/5" : ""}`}>
                  <td className="px-4 py-3 font-semibold text-primary">{d.destination}</td>
                  <td className="px-4 py-3">{d.date}</td>
                  <td className="px-4 py-3">
                    {d.seats_left}/{d.total_seats}
                  </td>
                  <td className="px-4 py-3 capitalize">{d.status.replace("-", " ")}</td>
                  <td className="px-4 py-3">
                    <SecondaryButton size="sm" variant="ghost" onClick={() => toggleActive(d)}>
                      {d.is_active ? "Visible" : "Hidden"}
                    </SecondaryButton>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      {confirmingId === d.id ? (
                        <>
                          <span className="self-center whitespace-nowrap text-xs font-semibold text-red-600">Delete permanently?</span>
                          <SecondaryButton size="sm" variant="outline-coral" onClick={() => remove(d.id)}>
                            Yes, delete
                          </SecondaryButton>
                          <SecondaryButton size="sm" variant="ghost" onClick={() => setConfirmingId(null)}>
                            Keep
                          </SecondaryButton>
                        </>
                      ) : (
                        <>
                          <SecondaryButton size="sm" variant="ghost" onClick={() => startEdit(d)} disabled={workingId === d.id}>
                            Edit
                          </SecondaryButton>
                          <SecondaryButton size="sm" variant="outline-coral" onClick={() => { setRowError(null); setConfirmingId(d.id); }} isLoading={workingId === d.id} disabled={workingId === d.id}>
                            Delete
                          </SecondaryButton>
                        </>
                      )}
                    </div>
                    {rowError?.id === d.id && (
                      <p role="alert" className="mt-2 max-w-xs ml-auto text-right text-xs font-medium text-red-600">{rowError.message}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
