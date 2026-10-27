"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import DepartureCards from "@/components/departures/DepartureCards";
import { useCollection } from "@/lib/admin/store";
import type { TourPackage } from "@/data/mockData";
import { homepagePackages } from "@/lib/packageCategory";
import type { GroupDeparture } from "@/lib/departures/types";

/** Every visible group departure from the admin panel's Departures page, with live seat counts. */
export default function DeparturesPageClient() {
  const { items: packages } = useCollection<TourPackage>("packages");
  const publishedPackages = homepagePackages(packages, "all", Infinity);
  const [departures, setDepartures] = useState<GroupDeparture[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/departures", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error("Could not load departures.");
        return res.json();
      })
      .then((data) => setDepartures(data.departures || []))
      .catch(() => {
        setFailed(true);
        setDepartures([]);
      });
  }, []);

  return (
    <section className="bg-[#edf2f5] py-14 dark:bg-sand sm:py-20">
      <Container>
        {departures === null ? (
          <p className="py-10 text-center text-sm text-foreground-muted" role="status">Loading departures…</p>
        ) : departures.length === 0 ? (
          <div className="mx-auto max-w-xl rounded-lg border border-primary/10 bg-white p-8 text-center">
            <p className="font-heading text-xl font-bold text-primary">
              {failed ? "We couldn't load departures right now." : "No group departures are scheduled right now."}
            </p>
            <p className="mt-2 text-sm text-foreground-muted">
              {failed ? "Please refresh the page in a moment." : "New dates are added regularly. Browse our tours or ask us about upcoming dates."}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Link href="/packages" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-navy">
                Browse tours <ArrowRight size={16} />
              </Link>
              <Link href="/contact" className="inline-flex min-h-11 items-center rounded-lg border border-primary/20 bg-white px-5 py-3 text-sm font-bold text-primary hover:border-navy">
                Ask about dates
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-foreground-muted" role="status">
              {departures.length} upcoming {departures.length === 1 ? "departure" : "departures"} · seat counts update as bookings come in
            </p>
            <DepartureCards departures={departures} packages={publishedPackages} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" />
          </>
        )}
      </Container>
    </section>
  );
}
