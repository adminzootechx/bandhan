import "server-only";

import { getSql } from "@/lib/db";
import { seedForCollection } from "./seeds";
import type { CollectionKey, WithId } from "@/lib/admin/types";

const COLLECTIONS: CollectionKey[] = [
  "destinations",
  "packages",
  "testimonials",
  "gallery",
  "features",
  "blog",
  "banners",
  "announcements",
  "enquiries",
];

export function isCollectionKey(value: string): value is CollectionKey {
  return COLLECTIONS.includes(value as CollectionKey);
}

const seeding = new Map<CollectionKey, Promise<void>>();

function ensureSeeded(key: CollectionKey): Promise<void> {
  const existing = seeding.get(key);
  if (existing) return existing;
  const pending = seedCollection(key).catch((error) => {
    seeding.delete(key);
    throw error;
  });
  seeding.set(key, pending);
  return pending;
}

async function seedCollection(key: CollectionKey) {
  const seeds = seedForCollection(key);
  if (seeds.length === 0) return;
  const sql = getSql();
  const payload = JSON.stringify(seeds);
  // Seeds only fill an empty collection. Re-inserting them on every cold start
  // resent the whole catalogue and brought back items an admin had deleted.
  await sql`
    INSERT INTO site_content (collection_key, item_id, data, sort_order)
    SELECT
      ${key},
      item->>'id',
      item,
      (ordinality - 1)::int
    FROM jsonb_array_elements(${payload}::jsonb) WITH ORDINALITY AS seed(item, ordinality)
    WHERE NOT EXISTS (SELECT 1 FROM site_content WHERE collection_key = ${key})
    ON CONFLICT (collection_key, item_id) DO NOTHING
  `;
}

async function readContent<T extends WithId>(key: CollectionKey): Promise<T[]> {
  const sql = getSql();
  const rows = (await sql`
    SELECT data, created_at, updated_at
    FROM site_content
    WHERE collection_key = ${key}
    ORDER BY sort_order ASC, created_at ASC
  `) as Array<{ data: T; created_at: string; updated_at: string }>;
  return rows.map((row) => key === "packages"
    ? { ...row.data, createdAt: row.created_at, updatedAt: row.updated_at }
    : row.data);
}

export async function listContent<T extends WithId = WithId>(key: CollectionKey): Promise<T[]> {
  // A populated collection is read in one query; seeding is only attempted when it's empty.
  const items = await readContent<T>(key);
  if (items.length || seedForCollection(key).length === 0) return items;
  await ensureSeeded(key);
  return readContent<T>(key);
}

/** True while an announcement's optional start/end window includes `now`. */
export function isWithinSchedule<T extends WithId>(item: T, now = Date.now()): boolean {
  const data = item as unknown as Record<string, unknown>;
  const startsAt = typeof data.startsAt === "string" && data.startsAt ? Date.parse(data.startsAt) : null;
  const endsAt = typeof data.endsAt === "string" && data.endsAt ? Date.parse(data.endsAt) : null;
  if (startsAt && startsAt > now) return false;
  if (endsAt && endsAt < now) return false;
  return true;
}

/** Published items. `schedule: false` skips the announcement time window so a cached list can apply it per request. */
export async function listPublicContent<T extends WithId = WithId>(
  key: Exclude<CollectionKey, "enquiries">,
  { schedule = true }: { schedule?: boolean } = {}
): Promise<T[]> {
  const items = await listContent<T>(key);
  return items.filter((item) => {
    const data = item as Record<string, unknown>;
    if (data.status === "draft") return false;
    if (key === "blog" && data.isPublished === false) return false;
    if ((key === "banners" || key === "announcements") && data.isActive === false) return false;
    if (key === "announcements" && schedule) return isWithinSchedule(item);
    return true;
  });
}

export async function createContentItem<T extends WithId>(
  key: CollectionKey,
  item: T
): Promise<T> {
  await ensureSeeded(key);
  const sql = getSql();
  const payload = JSON.stringify(item);
  const rows = (await sql`
    INSERT INTO site_content (collection_key, item_id, data, sort_order)
    VALUES (
      ${key}, ${item.id}, ${payload}::jsonb,
      COALESCE((SELECT MAX(sort_order) + 1 FROM site_content WHERE collection_key = ${key}), 0)
    )
    ON CONFLICT (collection_key, item_id)
    DO UPDATE SET data = EXCLUDED.data, updated_at = now()
    RETURNING data
  `) as Array<{ data: T }>;
  return rows[0].data;
}

export async function updateContentItem<T extends WithId>(
  key: CollectionKey,
  id: string,
  patch: Partial<T>
): Promise<T | null> {
  await ensureSeeded(key);
  const sql = getSql();
  const patchJson = JSON.stringify(patch);
  const rows = (await sql`
    UPDATE site_content
    SET data = data || ${patchJson}::jsonb || jsonb_build_object('id', item_id), updated_at = now()
    WHERE collection_key = ${key} AND item_id = ${id}
    RETURNING data
  `) as Array<{ data: T }>;
  return rows[0]?.data ?? null;
}

export async function deleteContentItem(key: CollectionKey, id: string): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`
    DELETE FROM site_content
    WHERE collection_key = ${key} AND item_id = ${id}
    RETURNING item_id
  `) as Array<{ item_id: string }>;
  return rows.length > 0;
}

export async function listCustomerEnquiries(userId: string) {
  const sql = getSql();
  const rows = (await sql`
    SELECT data
    FROM site_content
    WHERE collection_key = 'enquiries' AND data->>'userId' = ${userId}
    ORDER BY created_at DESC
  `) as Array<{ data: WithId }>;
  return rows.map((row) => row.data);
}
