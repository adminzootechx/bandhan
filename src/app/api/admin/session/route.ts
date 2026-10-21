import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminSessionCookieOptions, isAdminConfigured, requireAdmin, sessionToken } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const headers = { "Cache-Control": "private, no-store, max-age=0" };
  if (!isAdminConfigured()) {
    return NextResponse.json({ ok: false, error: "Admin access is not configured." }, { status: 503, headers });
  }
  if (!requireAdmin(request)) {
    return NextResponse.json({ ok: false, error: "Your admin session has expired. Please sign in again." }, { status: 401, headers });
  }
  return NextResponse.json({ ok: true }, { headers });
}

/** Renew an existing login only; an expired or invalid cookie still requires a password. */
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ ok: false, error: "Invalid request origin." }, { status: 403 });
  }
  const response = await GET(request);
  if (response.ok) response.cookies.set(ADMIN_COOKIE, sessionToken(), adminSessionCookieOptions());
  return response;
}
