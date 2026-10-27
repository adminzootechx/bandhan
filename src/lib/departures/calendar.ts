import type { TourPackage } from "@/data/mockData";
import { packageDestinationLabel } from "@/lib/packageCategory";
import { isCalendarDate, packageDateBookingHref, upcomingPackageDates } from "@/lib/packageDates";
import type { GroupDeparture } from "./types";

export interface CalendarDate {
  /** YYYY-MM-DD */
  date: string;
  endDate?: string;
  /** Package dates book through /book; group departures open the seat-aware modal. */
  href?: string;
  departure?: GroupDeparture;
}

export interface CalendarJourney {
  key: string;
  title: string;
  /** Itinerary page, when the journey is a published package. */
  href?: string;
  duration: string;
  destination: string;
  collection: string;
  dates: CalendarDate[];
}

export interface CalendarMonth {
  /** YYYY-MM */
  key: string;
  year: number;
  /** 0-based */
  month: number;
}

/** Departures that can't be tied to a published package still deserve a home. */
export const UNMATCHED_COLLECTION = "Group Departures";

const COLLECTION_ORDER = ["International", "Domestic", "North East", "Group Tours", UNMATCHED_COLLECTION];

const COLLECTION_HEADINGS: Record<string, string> = {
  "Group Tours": "Group tour departures",
  [UNMATCHED_COLLECTION]: "More group departures",
};

export function collectionHeading(collection: string) {
  return COLLECTION_HEADINGS[collection] ?? `${collection} departures`;
}

export const COLLECTION_DESCRIPTIONS: Record<string, string> = {
  International: "Fixed-date holidays abroad, from South East Asia to Europe",
  Domestic: "Guided journeys along India's classic routes",
  "North East": "The Seven Sisters and the Eastern Himalaya",
  "Group Tours": "Join a fixed-date group and travel together",
  [UNMATCHED_COLLECTION]: "Fixed dates with live seat availability",
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/**
 * Group departure dates are typed by hand in the admin ("Nov 01, Nov 04",
 * "Aug 15, 2026", "Sep 24, 28 | Oct 01"). Read every day mentioned, carrying
 * the last month forward, and give undated years the next occurrence.
 */
export function parseDepartureDates(value: string, today: string): string[] {
  const iso = value.match(/\d{4}-\d{2}-\d{2}/g)?.filter(isCalendarDate);
  if (iso?.length) return iso;

  const [todayYear, todayMonth] = today.split("-").map(Number);
  const dates: string[] = [];
  let pending: Array<{ month: number; day: number }> = [];
  let month = -1;

  const flush = (year?: number) => {
    for (const item of pending) {
      // An earlier month means next year; earlier this month has simply passed.
      const inferred = item.month + 1 < todayMonth ? todayYear + 1 : todayYear;
      const candidate = `${year ?? inferred}-${pad(item.month + 1)}-${pad(item.day)}`;
      if (isCalendarDate(candidate)) dates.push(candidate);
    }
    pending = [];
  };

  for (const [token] of value.matchAll(/[A-Za-z]+|\d+/g)) {
    if (/^[A-Za-z]+$/.test(token)) {
      const index = MONTHS.indexOf(token.slice(0, 3).toLowerCase());
      if (index >= 0) month = index;
    } else if (token.length === 4) {
      flush(Number(token));
    } else if (month >= 0 && Number(token) >= 1 && Number(token) <= 31) {
      pending.push({ month, day: Number(token) });
    }
  }
  flush();
  return [...new Set(dates)].sort();
}

const STOP_WORDS = new Set(["tour", "tours", "special", "the", "and", "with", "of", "best", "days", "nights"]);

function titleWords(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
  );
}

/** Ties an admin-entered departure to its package when at least two distinctive words agree. */
function matchPackage(destination: string, packages: TourPackage[]) {
  const words = titleWords(destination);
  let best: { pkg: TourPackage; score: number } | null = null;
  for (const pkg of packages) {
    const score = [...titleWords(pkg.title)].filter((word) => words.has(word)).length;
    if (score >= 2 && (!best || score > best.score)) best = { pkg, score };
  }
  return best?.pkg;
}

export function buildCalendar(
  packages: TourPackage[],
  departures: GroupDeparture[],
  today: string
): CalendarJourney[] {
  const published = packages.filter((pkg) => pkg.status !== "draft");
  const journeys = new Map<string, CalendarJourney>();

  for (const pkg of published) {
    const dates = upcomingPackageDates(pkg.departureDates, today);
    journeys.set(pkg.id, {
      key: pkg.id,
      title: pkg.title,
      href: `/packages/${pkg.id}`,
      duration: pkg.duration.trim(),
      destination: packageDestinationLabel(pkg),
      collection: pkg.category || UNMATCHED_COLLECTION,
      dates: dates.map(({ startDate, endDate }) => ({
        date: startDate,
        ...(endDate ? { endDate } : {}),
        href: packageDateBookingHref(pkg.id, startDate),
      })),
    });
  }

  for (const departure of departures) {
    if (departure.is_active === false) continue;
    const dates = parseDepartureDates(departure.date, today).filter((date) => date >= today);
    if (!dates.length) continue;

    const pkg = matchPackage(departure.destination, published);
    const key = pkg?.id ?? `departure-${departure.id}`;
    const journey = journeys.get(key) ?? {
      key,
      title: departure.destination,
      duration: departure.duration?.trim() || "",
      destination: "",
      collection: UNMATCHED_COLLECTION,
      dates: [],
    };
    for (const date of dates) {
      // Prefer the seat-aware departure over a bare package date on the same day.
      const existing = journey.dates.find((item) => item.date === date);
      if (existing) existing.departure = departure;
      else journey.dates.push({ date, departure });
    }
    journeys.set(key, journey);
  }

  const rank = (collection: string) => {
    const index = COLLECTION_ORDER.indexOf(collection);
    return index === -1 ? COLLECTION_ORDER.length - 1 : index;
  };

  return [...journeys.values()]
    .filter((journey) => journey.dates.length > 0)
    .map((journey) => ({ ...journey, dates: journey.dates.sort((a, b) => a.date.localeCompare(b.date)) }))
    .sort((a, b) => rank(a.collection) - rank(b.collection) || a.dates[0].date.localeCompare(b.dates[0].date));
}

export function collectionOrder(journeys: CalendarJourney[]) {
  return [...new Set(journeys.map((journey) => journey.collection))];
}

/** From this month through the last scheduled departure, at least a year and at most two. */
export function calendarMonths(journeys: CalendarJourney[], today: string): CalendarMonth[] {
  const [year, month] = today.split("-").map(Number);
  const start = year * 12 + month - 1;
  const last = journeys
    .flatMap((journey) => journey.dates.map((item) => item.date))
    .reduce((latest, date) => {
      const [y, m] = date.split("-").map(Number);
      return Math.max(latest, y * 12 + m - 1);
    }, start);
  const end = Math.min(Math.max(last, start + 11), start + 23);

  return Array.from({ length: end - start + 1 }, (_, offset) => {
    const index = start + offset;
    const value = { year: Math.floor(index / 12), month: index % 12 };
    return { ...value, key: `${value.year}-${pad(value.month + 1)}` };
  });
}

export function datesInMonth(journey: CalendarJourney, monthKey: string) {
  return journey.dates.filter((item) => item.date.startsWith(monthKey));
}
