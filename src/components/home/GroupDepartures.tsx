"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionTitle } from "@/components/ui/SectionTitle";
import DepartureCards from "@/components/departures/DepartureCards";
import { useCollection } from "@/lib/admin/store";
import type { TourPackage } from "@/data/mockData";
import { homepagePackages, isGroupTour, matchesTravelStyle, TRAVEL_STYLE_FILTERS, type TravelStyleFilter } from "@/lib/packageCategory";
import { PackageCard } from "@/components/home/FeaturedPackages";
import type { GroupDeparture } from "@/lib/departures/types";

export const GroupDepartures: React.FC = () => {
  const { items: packages } = useCollection<TourPackage>("packages");
  const [travelStyle, setTravelStyle] = useState<TravelStyleFilter>("group");
  const [visibleCount, setVisibleCount] = useState(6);
  const publishedPackages = homepagePackages(packages, "all", Infinity);
  const matchingPackages = publishedPackages.filter((pkg) => matchesTravelStyle(pkg, travelStyle));
  const visiblePackages = matchingPackages.slice(0, visibleCount);
  const [groupDepartures, setGroupDepartures] = useState<GroupDeparture[]>([]);
  const visibleDepartures = travelStyle === "all" || travelStyle === "group" || travelStyle === "special-departure"
    ? groupDepartures
    : [];
  const activeStyleLabel = TRAVEL_STYLE_FILTERS.find((style) => style.key === travelStyle)!.label;

  useEffect(() => {
    fetch("/api/departures", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setGroupDepartures(data.departures || []))
      .catch(() => setGroupDepartures([]));
  }, []);

  if (groupDepartures.length === 0 && publishedPackages.length === 0) return null;

  return (
    <section
      id="group-departures"
      className="relative z-10 border-y border-primary/10 bg-[#edf2f5] py-16 dark:bg-sand sm:py-24"
    >
      <Container>
        <div className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionTitle
            align="left"
            badge="Travel together"
            title="Group Tours"
            description="Explore group tours, customizable holidays, seasonal journeys, and special departures. Choose a journey style below."
            className="max-w-3xl"
          />
          <div className="hidden items-center gap-3 border-l border-primary/15 pl-5 text-primary lg:flex">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-primary">
              <CheckCircle2 size={20} strokeWidth={2.25} />
            </span>
            <div>
              <p className="text-sm font-bold">Expert-led group tours</p>
              <p className="text-xs text-foreground-muted">Everything planned, just show up</p>
            </div>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter homepage tours by journey style">
          {TRAVEL_STYLE_FILTERS.map((style) => (
            <button
              key={style.key}
              type="button"
              aria-pressed={travelStyle === style.key}
              aria-controls="homepage-journey-results"
              onClick={() => {
                setTravelStyle(style.key);
                setVisibleCount(6);
              }}
              className={`min-h-11 rounded-full border px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${
                travelStyle === style.key
                  ? "border-gold bg-gold text-primary"
                  : "border-primary/20 bg-white text-primary/75 hover:border-navy hover:bg-navy/5 hover:text-navy"
              }`}
            >
              {style.label}
            </button>
          ))}
        </div>
        <p className="mb-6 text-sm text-foreground-muted" role="status" aria-live="polite" aria-atomic="true">
          {activeStyleLabel}: {matchingPackages.length} {matchingPackages.length === 1 ? "tour" : "tours"}
          {visibleDepartures.length > 0 ? ` · ${visibleDepartures.length} upcoming ${visibleDepartures.length === 1 ? "departure" : "departures"}` : ""}
        </p>

        <div id="homepage-journey-results">
        {visiblePackages.length > 0 ? (
          <div className="mb-10">
            <div className="grid gap-5 lg:grid-cols-2">
              {visiblePackages.map((pkg) => <PackageCard key={pkg.id} pkg={pkg} layout={isGroupTour(pkg) ? "group" : "standard"} />)}
            </div>
            {visibleCount < matchingPackages.length && (
              <button type="button" onClick={() => setVisibleCount((count) => count + 6)} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg border border-primary/20 bg-white px-5 py-3 text-sm font-bold text-primary hover:border-navy" aria-controls="homepage-journey-results">
                Show more tours <ArrowRight size={16} />
              </button>
            )}
          </div>
        ) : null}
        {visiblePackages.length === 0 && visibleDepartures.length === 0 && (
          <div className="mb-10 rounded-lg border border-primary/10 bg-white p-8 text-center">
            <p className="text-sm text-foreground-muted">No published tours match this journey style yet.</p>
            <button type="button" onClick={() => { setTravelStyle("all"); setVisibleCount(6); }} className="mt-3 min-h-11 text-sm font-bold text-primary underline underline-offset-4">Show every journey</button>
          </div>
        )}
        {visibleDepartures.length > 0 ? (
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
            <h3 className="text-xl font-bold text-primary">Upcoming departures</h3>
            <Link href="/departures" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-primary underline-offset-4 hover:underline">
              View all departures <ArrowRight size={16} />
            </Link>
          </div>
        ) : null}
        <DepartureCards departures={visibleDepartures} packages={publishedPackages} />
        </div>
      </Container>

    </section>
  );
};

export default GroupDepartures;
