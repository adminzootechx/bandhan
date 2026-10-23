"use client";

import React, { useState } from "react";
import HeroCarousel from "./HeroCarousel";
import { ArrowRight, MapPin, Search } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ParallaxBand } from "@/components/ui/ParallaxBand";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { useRecentSearches } from "@/lib/recentSearches";
import { useCollection } from "@/lib/admin/store";
import { fuzzySearch, PACKAGE_SEARCH_KEYS } from "@/lib/fuzzySearch";
import { PlaceSearchInput } from "@/components/ui/PlaceSearchInput";
import type { Destination, TourPackage } from "@/data/mockData";
import type { Banner } from "@/lib/admin/types";

interface HeroProps {
  onSearchSubmit: (href: string) => void;
  onPlanTripClick: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onSearchSubmit, onPlanTripClick }) => {
  const [destination, setDestination] = useState("");
  const [searchError, setSearchError] = useState("");
  const { saveRecentSearch } = useRecentSearches();
  const { items: packages } = useCollection<TourPackage>("packages");
  const { items: destinations } = useCollection<Destination>("destinations");
  const { items: banners } = useCollection<Banner>("banners");
  const banner = banners.find((item) => item.isActive);
  const japanBannerImage = "/images/japan-hero.webp";
  // Existing databases retain the original seeded banner until an editor changes it.
  const isJapanBanner = !banner || banner.image === japanBannerImage || (
    banner.id === "homepage-primary" &&
    banner.image === "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&q=90&w=3200"
  );

  const runSearch = (text: string) => {
    const query = text.trim();
    if (!query) {
      setSearchError("");
      onSearchSubmit("/packages");
      return;
    }
    saveRecentSearch({ label: query, destination: query });

    const matches = fuzzySearch(packages.filter((pkg) => pkg.status !== "draft"), query, PACKAGE_SEARCH_KEYS);

    // One confident match goes straight to that tour; anything broader lands
    // on the packages page with the search still applied and adjustable.
    if (matches.length === 1) {
      setSearchError("");
      onSearchSubmit(`/packages/${encodeURIComponent(matches[0].id)}`);
      return;
    }
    if (matches.length > 1) {
      setSearchError("");
      onSearchSubmit(`/packages?${new URLSearchParams({ search: query })}`);
      return;
    }

    // No package fits. A destination page is still a useful landing spot when
    // the traveller named somewhere we cover.
    const destinationMatch = fuzzySearch(
      destinations.filter((item) => item.status !== "draft"),
      query,
      ["name", "country", "region", "tag", "description", "highlights"]
    )[0];
    if (destinationMatch) {
      setSearchError("");
      onSearchSubmit(`/destinations/${encodeURIComponent(destinationMatch.id)}`);
      return;
    }

    setSearchError("No tour matches that destination. Try another spelling, or browse the full catalogue.");
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(destination);
  };

  const searchPanel = (
    <div className="w-full">
      <form
        onSubmit={handleSearch}
        role="search"
        aria-label="Find a holiday"
        className={isJapanBanner
          ? "flex items-center gap-3 rounded-2xl border border-blue-100 bg-white p-3 shadow-[0_12px_40px_-18px_rgba(30,58,138,0.24)] transition-[border-color,box-shadow] duration-300 focus-within:border-blue-600/35 focus-within:shadow-[0_14px_46px_-16px_rgba(37,99,235,0.2)] sm:gap-5 sm:p-3.5 sm:pl-5"
          : "flex flex-col gap-3 rounded-xl bg-white p-3 shadow-[0_18px_50px_-20px_rgba(3,12,23,0.65)] sm:flex-row sm:items-center sm:p-4"}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className={`shrink-0 items-center justify-center ${isJapanBanner ? "hidden size-11 rounded-full bg-blue-50 text-blue-600 sm:flex" : "flex size-10 text-accent"}`}>
            <MapPin size={20} strokeWidth={1.7} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1 px-1 py-1">
            <label htmlFor="hero-destination" className="mb-1 block text-[9px] font-bold uppercase tracking-[0.14em] text-primary/50 sm:text-[10px]">
              {isJapanBanner ? "Your next journey" : "Destination or city"}
            </label>
            <PlaceSearchInput
              id="hero-destination"
              value={destination}
              onValueChange={(value) => {
                setDestination(value);
                if (searchError) setSearchError("");
              }}
              onPick={(place) => runSearch(place.label)}
              placeholder={isJapanBanner ? "Search destinations" : "e.g. Kashmir, Munnar, Bali, Europe"}
              className="h-7 w-full border-0 bg-transparent text-base font-medium text-primary outline-none placeholder:font-normal placeholder:text-primary/45"
            />
          </div>
        </div>
        <PrimaryButton
          type="submit"
          variant={isJapanBanner ? "navy" : "coral"}
          size="md"
          className={isJapanBanner
            ? "h-12 shrink-0 !rounded-xl !bg-blue-600 !px-4 !shadow-none hover:!bg-blue-700 hover:!shadow-none focus:!ring-blue-500 sm:h-14 sm:!px-7"
            : "h-12 shrink-0 whitespace-nowrap !rounded-lg px-6"}
          leftIcon={<Search size={17} aria-hidden="true" />}
        >
          {isJapanBanner ? "Search" : "Find my trip"}
        </PrimaryButton>
      </form>
      {searchError ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-2" role="alert">
          <p className={`text-xs font-medium ${isJapanBanner ? "text-red-700" : "text-white"}`}>{searchError}</p>
          <button
            type="button"
            onClick={() => onSearchSubmit("/packages")}
            className={`text-xs font-semibold underline underline-offset-4 ${isJapanBanner ? "text-primary hover:text-accent" : "text-gold hover:text-white"}`}
          >
            Browse all tours
          </button>
        </div>
      ) : null}
    </div>
  );

  if (isJapanBanner) {
    return (
      <section className="relative z-20 w-full bg-white pt-[88px] sm:pt-[104px]" aria-label="Holiday offers">
        <HeroCarousel />
        <Container className="relative z-20 mt-3 sm:mt-4">
          <div className="mx-auto max-w-4xl">{searchPanel}</div>
        </Container>
      </section>
    );
  }

  return (
    <ParallaxBand image={banner.image} alt="" overlay={65} priority className="w-full">
      <div className="relative z-10 pb-14 pt-28 sm:pb-16 sm:pt-36 lg:pb-20 lg:pt-44">
        <Container>
          <div className="max-w-3xl text-left text-white">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-gold">
              {banner.badge || "Thoughtful journeys, planned well"}
            </p>
            <h1 className="font-heading text-4xl font-bold leading-[1.04] tracking-[-0.04em] text-white sm:text-5xl md:text-6xl lg:text-7xl">
              {banner.title || "Explore Beyond"}{" "}
              <span className="text-gold">{banner.highlightedTitle || "Boundaries"}</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/80 sm:text-lg">
              {banner.description || "Discover unforgettable domestic and international journeys custom-tailored for the discerning modern traveler."}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <PrimaryButton
                variant="coral"
                size="md"
                onClick={() => onSearchSubmit("/packages")}
                className="w-full !rounded-lg sm:w-auto"
                rightIcon={<ArrowRight size={18} aria-hidden="true" />}
              >
                {banner.primaryLabel || "Explore Tours"}
              </PrimaryButton>
              <SecondaryButton variant="glass" size="md" onClick={onPlanTripClick} className="w-full !rounded-lg sm:w-auto">
                {banner.secondaryLabel || "Plan My Trip"}
              </SecondaryButton>
            </div>
          </div>
          <div className="mt-12">{searchPanel}</div>
        </Container>
      </div>
    </ParallaxBand>
  );
};

export default Hero;
