"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, LayoutGrid, Search } from "lucide-react";
import { Container } from "@/components/ui/Container";
import PageShell from "@/components/ui/PageShell";
import PageHero from "@/components/ui/PageHero";
import BookingModal from "@/components/packages/BookingModal";
import { useCollection } from "@/lib/admin/store";
import type { TourPackage } from "@/data/mockData";
import { contactEnquiryHref } from "@/lib/enquiryLink";
import { todayInIndia } from "@/lib/packageDates";
import { getDepartureUrgency, type GroupDeparture } from "@/lib/departures/types";
import {
  COLLECTION_DESCRIPTIONS,
  buildCalendar,
  collectionHeading,
  calendarMonths,
  collectionOrder,
  datesInMonth,
  type CalendarDate,
  type CalendarJourney,
  type CalendarMonth,
} from "@/lib/departures/calendar";

type View = "monthly" | "grid";

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Oct ’26" for the first column and each January, plain "Nov" otherwise. */
function monthLabel(month: CalendarMonth, index: number) {
  const short = MONTH_SHORT[month.month];
  return index === 0 || month.month === 0 ? `${short} ’${String(month.year).slice(2)}` : short;
}

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

function seatState(item: CalendarDate) {
  if (!item.departure) return { tone: "open" as const, seats: null };
  const seats = Math.max(item.departure.seats_left, 0);
  const urgency = getDepartureUrgency(item.departure.seats_left, item.departure.total_seats);
  if (seats === 0) return { tone: "sold-out" as const, seats };
  if (urgency?.status === "limited-seats") return { tone: "limited" as const, seats };
  if (urgency?.status === "filling-fast") return { tone: "filling" as const, seats };
  return { tone: "open" as const, seats };
}

const PILL_TONES = {
  open: "border-primary/20 bg-white text-primary hover:border-primary hover:bg-primary hover:text-white",
  filling: "border-gold/60 bg-gold/15 text-primary hover:border-gold-dark hover:bg-gold hover:text-primary",
  limited: "border-accent/40 bg-accent/10 text-accent-dark hover:border-accent hover:bg-accent hover:text-white",
  "sold-out": "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400 line-through",
} as const;

function DatePill({
  item,
  journey,
  size = "md",
  onSelectDeparture,
}: {
  item: CalendarDate;
  journey: CalendarJourney;
  size?: "sm" | "md";
  onSelectDeparture: (departure: GroupDeparture, date: string) => void;
}) {
  const { tone, seats } = seatState(item);
  const day = Number(item.date.slice(8));
  const seatText = seats === null ? "" : seats === 0 ? "Sold out" : `${seats} ${seats === 1 ? "seat" : "seats"}`;
  const title = `${journey.title} — ${formatLongDate(item.date)}${seatText ? ` · ${seatText}` : ""}`;
  const className = `inline-flex flex-col items-center justify-center rounded-lg border font-bold leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${
    size === "sm" ? "min-h-10 min-w-10 px-1.5 py-1 text-sm" : "min-h-12 min-w-12 px-2 py-1.5 text-base"
  } ${PILL_TONES[tone]}`;
  const content = (
    <>
      <time dateTime={item.date}>{day}</time>
      {seatText ? <span className="mt-1 text-[9px] font-semibold no-underline opacity-80">{seats === 0 ? "Full" : seatText}</span> : null}
    </>
  );

  if (tone === "sold-out") {
    return (
      <span className={className} title={title} aria-label={title}>
        {content}
      </span>
    );
  }
  if (item.departure) {
    const departure = item.departure;
    return (
      <button type="button" className={className} title={title} aria-label={`Book ${title}`} onClick={() => onSelectDeparture(departure, item.date)}>
        {content}
      </button>
    );
  }
  return (
    <Link href={item.href ?? contactEnquiryHref(journey.title)} className={className} title={title} aria-label={`Book ${title}`}>
      {content}
    </Link>
  );
}

function journeyMeta(journey: CalendarJourney) {
  return [journey.duration, journey.destination].filter(Boolean).join(" · ");
}

function SectionHeader({ collection, as: Heading = "h3" }: { collection: string; as?: "h3" | "span" }) {
  return (
    <>
      <Heading className="block font-heading text-lg font-bold text-primary sm:text-xl">{collectionHeading(collection)}</Heading>
      {COLLECTION_DESCRIPTIONS[collection] ? (
        <span className="mt-1 block text-sm font-normal text-foreground-muted">{COLLECTION_DESCRIPTIONS[collection]}</span>
      ) : null}
    </>
  );
}

export default function DepartureCalendarClient() {
  const { items: packages, ready } = useCollection<TourPackage>("packages");
  const [departures, setDepartures] = useState<GroupDeparture[]>([]);
  const [departuresLoaded, setDeparturesLoaded] = useState(false);
  const [collection, setCollection] = useState("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("monthly");
  const [monthKey, setMonthKey] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ departure: GroupDeparture; date: string } | null>(null);

  useEffect(() => {
    fetch("/api/departures")
      .then((res) => res.json())
      .then((data) => setDepartures(data.departures || []))
      .catch(() => setDepartures([]))
      .finally(() => setDeparturesLoaded(true));
  }, []);

  const today = todayInIndia();
  const journeys = useMemo(() => buildCalendar(packages, departures, today), [packages, departures, today]);
  const months = useMemo(() => calendarMonths(journeys, today), [journeys, today]);
  const collections = useMemo(() => collectionOrder(journeys), [journeys]);

  const normalizedQuery = query.trim().toLowerCase();
  const filtered = journeys.filter(
    (journey) =>
      (collection === "all" || journey.collection === collection) &&
      (!normalizedQuery || `${journey.title} ${journey.destination}`.toLowerCase().includes(normalizedQuery))
  );
  const countFor = (key: string) => filtered.reduce((total, journey) => total + datesInMonth(journey, key).length, 0);

  // Open on the first month that actually has something to show.
  const firstBusyMonth = months.find((month) => countFor(month.key) > 0)?.key ?? months[0]?.key;
  const activeMonthKey = monthKey && months.some((month) => month.key === monthKey) ? monthKey : firstBusyMonth;
  const activeIndex = Math.max(0, months.findIndex((month) => month.key === activeMonthKey));
  const activeMonth = months[activeIndex];
  const monthJourneys = activeMonth ? filtered.filter((journey) => datesInMonth(journey, activeMonth.key).length > 0) : [];
  const monthCount = activeMonth ? countFor(activeMonth.key) : 0;
  const nextBusyMonth = months.slice(activeIndex + 1).find((month) => countFor(month.key) > 0);

  const totalDepartures = journeys.reduce((total, journey) => total + journey.dates.length, 0);
  const loading = !ready || !departuresLoaded;
  const seasonLabel = months.length
    ? months[0].year === months[months.length - 1].year
      ? `Season ${months[0].year}`
      : `Season ${months[0].year}–${String(months[months.length - 1].year).slice(2)}`
    : "";

  const selectDeparture = (departure: GroupDeparture, date: string) => setSelected({ departure, date });
  const visibleCollections = collections.filter((name) => filtered.some((journey) => journey.collection === name));

  return (
    <PageShell>
      <PageHero
        size="sm"
        eyebrow={journeys.length ? `${journeys.length} journeys · ${totalDepartures} departures · India & International` : "India & International"}
        title={
          <>
            Departure calendar
            {seasonLabel ? (
              <>
                <br />
                <em className="font-heading italic text-gold">{seasonLabel}.</em>
              </>
            ) : null}
          </>
        }
        description="Every fixed-date group departure we run, month by month. Pick a date to start your booking, or open the itinerary to see the full journey."
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Departures" }]}
      />

      <section className="py-10 sm:py-14">
        <Container>
          <div className="flex flex-col gap-4 border-b border-primary/10 pb-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter departures by collection">
              {["all", ...collections].map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={collection === name}
                  onClick={() => setCollection(name)}
                  className={`min-h-11 rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${
                    collection === name
                      ? "border-primary bg-primary text-white"
                      : "border-primary/20 bg-white text-primary/75 hover:border-navy hover:text-navy"
                  }`}
                >
                  {name === "all" ? "All collections" : name}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative block sm:w-64">
                <span className="sr-only">Search journeys</span>
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-foreground-light" aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search journeys"
                  className="min-h-11 w-full rounded-full border border-primary/20 bg-white py-2 pl-10 pr-4 text-sm text-primary placeholder:text-foreground-light focus:border-navy focus:outline-none"
                />
              </label>
              <div className="inline-flex rounded-full border border-primary/20 bg-white p-1" role="group" aria-label="Calendar view">
                {(
                  [
                    { key: "monthly", label: "Monthly view", icon: CalendarDays },
                    { key: "grid", label: "Full season grid", icon: LayoutGrid },
                  ] as const
                ).map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={view === key}
                    onClick={() => setView(key)}
                    className={`inline-flex min-h-9 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${
                      view === key ? "bg-gold text-primary" : "text-primary/70 hover:text-primary"
                    }`}
                  >
                    <Icon size={14} aria-hidden="true" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loading && journeys.length === 0 ? (
            <p className="py-16 text-center text-sm text-foreground-muted" role="status">
              Loading departures…
            </p>
          ) : journeys.length === 0 ? (
            <div className="my-10 rounded-lg border border-primary/10 bg-white p-8 text-center">
              <p className="font-heading text-xl font-bold text-primary">New departures are being scheduled</p>
              <p className="mt-2 text-sm text-foreground-muted">Tell us where you&apos;d like to go and we&apos;ll share the next dates as soon as they open.</p>
              <Link href={contactEnquiryHref()} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-bold text-white hover:bg-primary-light">
                Enquire about dates <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          ) : view === "monthly" && activeMonth ? (
            <div className="pt-6">
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setMonthKey(months[activeIndex - 1]?.key ?? null)}
                  disabled={activeIndex === 0}
                  aria-label="Previous month"
                  className="inline-flex min-h-11 items-center gap-1 rounded-full border border-primary/20 bg-white px-3 text-xs font-bold text-primary transition-colors hover:border-navy disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                  <span className="hidden sm:inline">Prev</span>
                </button>
                <div className="text-center" aria-live="polite" aria-atomic="true">
                  <h2 className="font-heading text-2xl font-extrabold text-primary sm:text-3xl">
                    {MONTH_LONG[activeMonth.month]} {activeMonth.year}
                  </h2>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-gold-dark">
                    {monthCount} {monthCount === 1 ? "departure" : "departures"} scheduled
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMonthKey(months[activeIndex + 1]?.key ?? null)}
                  disabled={activeIndex === months.length - 1}
                  aria-label="Next month"
                  className="inline-flex min-h-11 items-center gap-1 rounded-full border border-primary/20 bg-white px-3 text-xs font-bold text-primary transition-colors hover:border-navy disabled:cursor-not-allowed disabled:opacity-40 sm:px-4"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>

              <div className="-mx-4 mt-6 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0" role="group" aria-label="Choose a month">
                <div className="flex min-w-max gap-2">
                  {months.map((month, index) => {
                    const count = countFor(month.key);
                    const active = month.key === activeMonth.key;
                    return (
                      <button
                        key={month.key}
                        type="button"
                        aria-pressed={active}
                        aria-label={`${MONTH_LONG[month.month]} ${month.year}, ${count} ${count === 1 ? "departure" : "departures"}`}
                        onClick={() => setMonthKey(month.key)}
                        className={`relative min-h-11 rounded-full border px-4 text-xs font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy ${
                          active
                            ? "border-primary bg-primary text-white"
                            : count > 0
                              ? "border-primary/20 bg-white text-primary hover:border-navy"
                              : "border-transparent bg-transparent text-foreground-light hover:text-primary"
                        }`}
                      >
                        {monthLabel(month, index)}
                        {count > 0 && !active ? <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>

              {monthJourneys.length === 0 ? (
                <div className="mt-8 rounded-lg border border-dashed border-primary/20 bg-white/60 p-8 text-center">
                  <p className="text-sm text-foreground-muted">
                    No departures {normalizedQuery || collection !== "all" ? "match your filters " : ""}in {MONTH_LONG[activeMonth.month]}.
                  </p>
                  {nextBusyMonth ? (
                    <button type="button" onClick={() => setMonthKey(nextBusyMonth.key)} className="mt-3 min-h-11 text-sm font-bold text-primary underline underline-offset-4">
                      Jump to {MONTH_LONG[nextBusyMonth.month]} {nextBusyMonth.year}
                    </button>
                  ) : null}
                </div>
              ) : (
                <div className="mt-8 space-y-10">
                  {visibleCollections
                    .filter((name) => monthJourneys.some((journey) => journey.collection === name))
                    .map((name) => (
                      <div key={name}>
                        <div className="mb-4 border-l-2 border-gold pl-4">
                          <SectionHeader collection={name} />
                        </div>
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {monthJourneys
                            .filter((journey) => journey.collection === name)
                            .map((journey) => (
                              <article key={journey.key} className="flex flex-col rounded-lg border border-primary/10 bg-white p-5 transition-colors hover:border-primary/25">
                                <h4 className="font-heading text-lg font-bold leading-snug text-primary">
                                  {journey.href ? (
                                    <Link href={journey.href} className="hover:text-navy hover:underline hover:underline-offset-4">
                                      {journey.title}
                                    </Link>
                                  ) : (
                                    journey.title
                                  )}
                                </h4>
                                {journeyMeta(journey) ? <p className="mt-1 text-sm text-foreground-muted">{journeyMeta(journey)}</p> : null}

                                <div className="mt-4 border-t border-primary/10 pt-4">
                                  <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground-light">
                                    Dates in {MONTH_LONG[activeMonth.month]}
                                  </span>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {datesInMonth(journey, activeMonth.key).map((item) => (
                                      <DatePill key={item.date} item={item} journey={journey} onSelectDeparture={selectDeparture} />
                                    ))}
                                  </div>
                                </div>

                                <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                                  {journey.href ? (
                                    <Link href={journey.href} className="inline-flex min-h-11 items-center gap-1.5 text-sm font-bold text-primary hover:text-navy">
                                      View itinerary <ArrowRight size={15} aria-hidden="true" />
                                    </Link>
                                  ) : (
                                    <span />
                                  )}
                                  <Link
                                    href={contactEnquiryHref(journey.title)}
                                    className="inline-flex min-h-11 items-center rounded-full border border-primary/20 px-5 text-xs font-bold uppercase tracking-[0.12em] text-primary transition-colors hover:border-primary hover:bg-primary hover:text-white"
                                  >
                                    Enquire
                                  </Link>
                                </div>
                              </article>
                            ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          ) : (
            <div className="pt-6">
              {filtered.length === 0 ? (
                <p className="rounded-lg border border-dashed border-primary/20 bg-white/60 p-8 text-center text-sm text-foreground-muted">No journeys match your filters.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-primary/10 bg-white" tabIndex={0} role="region" aria-label="Season departure grid, scrollable">
                  <table className="w-full min-w-max border-collapse text-left">
                    <caption className="sr-only">
                      Departure dates by journey and month, {MONTH_LONG[months[0].month]} {months[0].year} to {MONTH_LONG[months[months.length - 1].month]} {months[months.length - 1].year}
                    </caption>
                    <thead>
                      <tr className="border-b border-primary/10 bg-sand-light">
                        <th scope="col" className="sticky left-0 z-10 min-w-56 bg-sand-light px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground-muted sm:min-w-72">
                          Journey &amp; route
                        </th>
                        {months.map((month, index) => (
                          <th key={month.key} scope="col" className="min-w-16 px-2 py-3 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-foreground-muted">
                            <time dateTime={month.key}>{monthLabel(month, index)}</time>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCollections.map((name) => (
                        <React.Fragment key={name}>
                          <tr className="border-b border-primary/10 bg-primary/[0.04]">
                            <th scope="colgroup" colSpan={months.length + 1} className="px-4 py-3 text-left">
                              <div className="sticky left-4 inline-block">
                                <SectionHeader collection={name} as="span" />
                              </div>
                            </th>
                          </tr>
                          {filtered
                            .filter((journey) => journey.collection === name)
                            .map((journey) => (
                              <tr key={journey.key} className="border-b border-primary/10 last:border-b-0">
                                <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-3 align-top font-normal">
                                  {journey.href ? (
                                    <Link href={journey.href} className="block text-sm font-bold text-primary hover:text-navy hover:underline hover:underline-offset-4">
                                      {journey.title}
                                    </Link>
                                  ) : (
                                    <span className="block text-sm font-bold text-primary">{journey.title}</span>
                                  )}
                                  {journeyMeta(journey) ? <span className="mt-0.5 block text-xs text-foreground-muted">{journeyMeta(journey)}</span> : null}
                                </th>
                                {months.map((month) => {
                                  const items = datesInMonth(journey, month.key);
                                  return (
                                    <td key={month.key} className="px-1.5 py-3 text-center align-top">
                                      {items.length ? (
                                        <ul className="mx-auto flex max-w-[5.75rem] flex-wrap justify-center gap-1.5">
                                          {items.map((item) => (
                                            <li key={item.date}>
                                              <DatePill item={item} journey={journey} size="sm" onSelectDeparture={selectDeparture} />
                                            </li>
                                          ))}
                                        </ul>
                                      ) : (
                                        <span className="text-foreground-light/60" aria-label="No departure">
                                          —
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {journeys.length > 0 ? (
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-foreground-muted">
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded border border-primary/30 bg-white" aria-hidden="true" /> Open departure
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded border border-gold/60 bg-gold/20" aria-hidden="true" /> Filling fast
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded border border-accent/40 bg-accent/15" aria-hidden="true" /> Few seats left
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-3 w-3 rounded border border-slate-300 bg-slate-200" aria-hidden="true" /> Sold out
              </span>
              <span className="inline-flex items-center gap-2">
                <span aria-hidden="true">—</span> No departure that month
              </span>
              <span className="font-semibold text-primary">Select any date to start a booking.</span>
            </div>
          ) : null}
        </Container>
      </section>

      <section className="border-t border-primary/10 bg-white py-14 sm:py-20">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold-dark">Before you book</span>
            <h2 className="mt-3 font-heading text-3xl font-extrabold leading-tight text-primary sm:text-4xl">
              Fixed dates,
              <br />
              <em className="italic text-navy">clearly shown.</em>
            </h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-foreground-muted">
              Choosing a date sends a booking request. Our team then confirms hotels, fares and seats with you before anything is paid.
            </p>
          </div>
          <ul className="space-y-5 text-sm leading-relaxed text-foreground-muted">
            <li className="border-l-2 border-gold pl-4">
              <strong className="block text-primary">Group departures</strong>
              Every date on this calendar is a fixed group departure, travelling with others on the same itinerary.
            </li>
            <li className="border-l-2 border-gold pl-4">
              <strong className="block text-primary">Live seat counts</strong>
              Where a date shows seats, the number updates as bookings are confirmed.
            </li>
            <li className="border-l-2 border-gold pl-4">
              <strong className="block text-primary">Your own dates</strong>
              Want to travel outside these dates? We can plan the same journey privately for your family or group.
              <Link href="/plan-a-custom-trip" className="mt-3 flex min-h-11 w-fit items-center gap-1.5 font-bold text-primary hover:text-navy">
                Plan a custom trip <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </li>
          </ul>
        </Container>
      </section>

      <BookingModal
        isOpen={selected !== null}
        onClose={() => setSelected(null)}
        packageTitle={selected?.departure.destination || ""}
        departureId={selected?.departure.id}
        initialTravelDate={
          selected
            ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${selected.date}T00:00:00Z`))
            : undefined
        }
        seatsLeft={selected?.departure.seats_left}
      />
    </PageShell>
  );
}
