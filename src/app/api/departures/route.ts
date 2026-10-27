import { NextResponse } from "next/server";
import { isDbConfigured } from "@/lib/db";
import { listCachedActiveDepartures } from "@/lib/departures/cache";

export async function GET() {
  if (!isDbConfigured()) return NextResponse.json({ departures: [] });

  try {
    const departures = await listCachedActiveDepartures();
    return NextResponse.json({ ok: true, departures });
  } catch (error) {
    console.error("list departures error:", error);
    return NextResponse.json({ ok: false, error: "Could not load departures." }, { status: 500 });
  }
}
