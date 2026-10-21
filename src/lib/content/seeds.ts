import {
  blogPosts,
  destinations,
  featuredPackages,
  galleryImages,
  whyChooseUs,
} from "@/data/mockData";
import { testimonialData } from "@/data/testimonialData";
import type { Banner, CollectionKey, WithId } from "@/lib/admin/types";

const defaultBanners: Banner[] = [
  {
    id: "homepage-primary",
    title: "Discover",
    highlightedTitle: "Japan",
    badge: "Experience the Beauty of Japan",
    description:
      "Cherry blossoms, timeless culture, and unforgettable journeys.",
    image: "/images/japan-hero.webp",
    primaryLabel: "Explore Japan",
    secondaryLabel: "Plan My Trip",
    isActive: true,
  },
];

export const contentSeeds: Record<CollectionKey, WithId[]> = {
  destinations,
  packages: featuredPackages,
  testimonials: testimonialData.map((item) => ({
    ...item,
    photo: item.profileImage,
  })),
  gallery: galleryImages,
  features: whyChooseUs,
  blog: blogPosts,
  banners: defaultBanners,
  announcements: [],
  enquiries: [],
};

export function seedForCollection<T extends WithId = WithId>(key: CollectionKey): T[] {
  return contentSeeds[key] as T[];
}
