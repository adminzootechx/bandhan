import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import { databaseScope } from "@/lib/content/cache";
import { listActiveDepartures } from "./db";
import type { GroupDeparture } from "./types";

function departuresTag() {
  return `public-departures:${databaseScope()}`;
}

/**
 * The homepage and /departures read this on every visit. Serving it from the
 * shared cache keeps visitor traffic from waking the database; every admin
 * change expires it, so seat counts stay current.
 */
export async function listCachedActiveDepartures(): Promise<GroupDeparture[]> {
  return unstable_cache(
    () => listActiveDepartures(),
    ["public-departures-v1", databaseScope()],
    { revalidate: 3600, tags: [departuresTag()] }
  )();
}

export function invalidatePublicDepartures() {
  revalidateTag(departuresTag(), { expire: 0 });
}
