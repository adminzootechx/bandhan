/** Slugs are route segments, even when an editor pastes surrounding slashes. */
export function normalizeBlogSlug<T extends object>(item: T): T {
  if (!("slug" in item) || typeof item.slug !== "string") return item;
  return { ...item, slug: item.slug.trim().replace(/^\/+|\/+$/g, "") };
}
