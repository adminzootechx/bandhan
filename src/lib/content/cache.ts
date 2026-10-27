import "server-only";

import { createHash } from "node:crypto";
import { revalidateTag, unstable_cache } from "next/cache";
import type { CollectionKey, WithId } from "@/lib/admin/types";
import { isWithinSchedule, listPublicContent } from "./db";

type PublicCollection = Exclude<CollectionKey, "enquiries">;

// Include the database identity: a migration must never reuse the old database's cache.
export function databaseScope() {
  return createHash("sha256").update(process.env.DATABASE_URL || "unconfigured").digest("hex").slice(0, 16);
}

function contentTag(key: CollectionKey) {
  return `public-content:${databaseScope()}:${key}`;
}

/** Shared by public JSON, package pages, metadata and brochures. No admin/customer data. */
export async function listCachedPublicContent<T extends WithId = WithId>(key: PublicCollection): Promise<T[]> {
  const items = await unstable_cache(
    // Scheduled announcements are cached unfiltered, then checked against their start/end times on each request.
    () => listPublicContent<T>(key, { schedule: false }),
    ["public-content-v1", databaseScope(), key],
    { revalidate: 3600, tags: [contentTag(key)] }
  )();
  return key === "announcements" ? items.filter((item) => isWithinSchedule(item)) : items;
}

/** Route handlers expire immediately so the next public read sees the saved content. */
export function invalidatePublicContent(key: CollectionKey) {
  if (key !== "enquiries") revalidateTag(contentTag(key), { expire: 0 });
}
