import "server-only";
import { cache } from "react";
import { featuredPackages, type TourPackage } from "@/data/mockData";
import { isDbConfigured } from "@/lib/db";
import { listCachedPublicContent } from "./cache";

// Metadata and the page share the same cached public catalogue as the JSON API.
const publishedPackages = cache(async () => isDbConfigured()
  ? listCachedPublicContent<TourPackage>("packages")
  : featuredPackages.filter((pkg) => pkg.status !== "draft"));

export async function getPublishedPackage(id: string) {
  return (await publishedPackages()).find((pkg) => pkg.id === id) ?? null;
}
