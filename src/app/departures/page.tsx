import type { Metadata } from "next";
import DepartureCalendarClient from "@/components/departures/DepartureCalendarClient";

export const metadata: Metadata = {
  title: "Departure Calendar | Bandhan Tours",
  description:
    "Every fixed-date group departure from Bandhan Tours, month by month — India and international journeys with live seat availability.",
};

export default function DeparturesPage() {
  return <DepartureCalendarClient />;
}
