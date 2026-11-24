import { permanentRedirect } from "next/navigation";

export default async function PlanTripPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (key === "type" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) query.append(key, item);
  }
  permanentRedirect(`/plan-a-custom-trip${query.size ? `?${query}` : ""}`);
}
