import React from "react";
import type { Metadata } from "next";
import PageShell from "@/components/ui/PageShell";
import PageHero from "@/components/ui/PageHero";
import DeparturesPageClient from "@/components/departures/DeparturesPageClient";

export const metadata: Metadata = {
  title: "Upcoming Group Departures | Bandhan Tours",
  description:
    "Fixed-date group tours from Bandhan Tours with live seat availability. Pick a departure, check seats left and book your place.",
};

export default function DeparturesPage() {
  return (
    <PageShell tone="ink">
      <PageHero
        eyebrow="Travel together"
        title="Upcoming group departures"
        description="Fixed-date group tours with live seat counts. Pick a departure and book your seats."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Group Departures" }]}
      />

      <DeparturesPageClient />
    </PageShell>
  );
}
