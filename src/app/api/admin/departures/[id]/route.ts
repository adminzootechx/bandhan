import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { requireAdmin } from "@/lib/admin/auth";
import { deleteDeparture, getDepartureById, updateDeparture } from "@/lib/departures/db";
import { invalidatePublicDepartures } from "@/lib/departures/cache";
import type { DepartureStatus } from "@/lib/departures/types";

const STATUSES: DepartureStatus[] = ["filling-fast", "limited-seats", "guaranteed", "sold-out"];

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface PatchBody {
  destination?: string;
  date?: string;
  duration?: string;
  price?: string;
  totalSeats?: string | number;
  seatsLeft?: string | number;
  status?: string;
  isActive?: boolean;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, error: "Not available." }, { status: 503 });
  }
  if (!requireAdmin(request)) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  }

  const { id } = await params;
  let body: PatchBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const totalSeats = body.totalSeats !== undefined ? Number(body.totalSeats) : undefined;
  if (totalSeats !== undefined && (!Number.isFinite(totalSeats) || totalSeats < 1)) {
    return NextResponse.json({ ok: false, error: "Invalid total seat count." }, { status: 400 });
  }
  const seatsLeft = body.seatsLeft !== undefined ? Number(body.seatsLeft) : undefined;
  if (seatsLeft !== undefined && (!Number.isFinite(seatsLeft) || seatsLeft < 0)) {
    return NextResponse.json({ ok: false, error: "Invalid seats-left count." }, { status: 400 });
  }
  if (body.status !== undefined && !STATUSES.includes(body.status as DepartureStatus)) {
    return NextResponse.json({ ok: false, error: "Invalid status." }, { status: 400 });
  }
  const destination = body.destination?.trim();
  if (destination !== undefined && destination.length < 2) {
    return NextResponse.json({ ok: false, error: "Please enter a destination." }, { status: 400 });
  }
  const date = body.date?.trim();
  if (date !== undefined && !date) {
    return NextResponse.json({ ok: false, error: "Please enter a departure date." }, { status: 400 });
  }

  try {
    if (totalSeats !== undefined || seatsLeft !== undefined) {
      const current = await getDepartureById(id);
      if (!current) return NextResponse.json({ ok: false, error: "Departure not found." }, { status: 404 });
      if ((seatsLeft ?? current.seats_left) > (totalSeats ?? current.total_seats)) {
        return NextResponse.json({ ok: false, error: "Seats left must be between 0 and the total seat count." }, { status: 400 });
      }
    }
    const departure = await updateDeparture(id, {
      destination,
      date,
      duration: body.duration?.trim(),
      price: body.price?.trim(),
      totalSeats,
      seatsLeft,
      status: body.status as DepartureStatus | undefined,
      isActive: body.isActive,
    });
    if (!departure) return NextResponse.json({ ok: false, error: "Departure not found." }, { status: 404 });
    invalidatePublicDepartures();
    return NextResponse.json({ ok: true, departure });
  } catch (error) {
    console.error("update departure error:", error);
    return NextResponse.json({ ok: false, error: "Could not update the departure." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, error: "Not available." }, { status: 503 });
  }
  if (!requireAdmin(request)) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 401 });
  }

  const { id } = await params;
  try {
    await deleteDeparture(id);
    invalidatePublicDepartures();
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Postgres foreign-key violation: a booking still points at this departure.
    if ((error as { code?: string })?.code === "23503") {
      return NextResponse.json(
        { ok: false, error: "This departure has bookings linked to it, so it can't be deleted. Click “Visible” to hide it from the website instead." },
        { status: 409 }
      );
    }
    console.error("delete departure error:", error);
    return NextResponse.json({ ok: false, error: "Could not delete the departure." }, { status: 500 });
  }
}
