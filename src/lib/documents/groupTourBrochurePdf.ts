import type { PDFImage } from "pdf-lib";
import type { FullPackage } from "@/data/packageDetails";
import type { ItineraryDay } from "@/data/mockData";
import { COMPANY } from "@/lib/email/company";
import { packageDestinationLabel, packageGroupSize } from "@/lib/packageCategory";
import { formatPackageDate, upcomingPackageDates } from "@/lib/packageDates";
import { formatPriceText, TAX_NOTE, withTaxMark } from "@/lib/priceLabel";
import { C, drawBrandMark } from "./pdf/chrome";
import { drawImageCover, loadProposalImage } from "./pdf/images";
import { CONTENT_WIDTH, hex, MARGIN, PAGE_HEIGHT, PAGE_WIDTH, PdfDoc } from "./pdf/layout";

const PAPER = hex("#FAF8F3");
const INK = hex("#142D43");
const MUTED = hex("#596976");
const LINE = hex("#DCDDD5");
const GOLD = hex("#D1A43D");
const BOTTOM = 770;
const BODY = 9;
const LEADING = 14;

type Photo = { image: PDFImage; caption: string };

function copy(doc: PdfDoc, value: string, options: { x?: number; width?: number; size?: number; bold?: boolean; color?: ReturnType<typeof hex>; gap?: number } = {}) {
  doc.paragraph(value, {
    x: options.x ?? MARGIN,
    maxWidth: options.width ?? CONTENT_WIDTH,
    size: options.size ?? BODY,
    lineHeight: (options.size ?? BODY) + 5,
    color: options.color ?? INK,
    bold: options.bold,
    spaceAfter: options.gap ?? 10,
  });
}

function kicker(doc: PdfDoc, value: string, x: number, y: number, color = MUTED) {
  doc.textAt(value.toUpperCase(), { x, y, size: 7, bold: true, charSpacing: 1.3, color });
}

function chapter(doc: PdfDoc, number: string, eyebrow: string, title: string) {
  const lines = doc.wrap(title, CONTENT_WIDTH - 65, 29, false, "serif");
  doc.ensure(65 + lines.length * 32);
  kicker(doc, eyebrow, MARGIN, doc.y, MUTED);
  doc.textAt(number, { x: PAGE_WIDTH - MARGIN - 50, y: doc.y - 4, width: 50, align: "right", size: 42, family: "serif", color: GOLD });
  doc.y += 21;
  for (const line of lines) {
    doc.textAt(line, { y: doc.y, size: 29, family: "serif", color: INK });
    doc.y += 32;
  }
  doc.y += 13;
  doc.rule(doc.y, LINE);
  doc.y += 20;
}

function chrome(doc: PdfDoc, destination: string, section: string) {
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, PAPER);
  drawBrandMark(doc, { y: 22, width: 80 });
  const available = CONTENT_WIDTH - 120;
  let size = 8;
  while (doc.measure(destination, size, true) > available && size > 5) size -= 0.25;
  doc.textAt(destination, { x: MARGIN + 120, y: 24, width: available, align: "right", size, bold: true, color: INK });
  doc.textAt(section, { x: MARGIN + 120, y: 40, width: available, align: "right", size: 6.5, color: MUTED });
  doc.rule(68, LINE);
  doc.y = 92;
}

function cover(doc: PdfDoc, pkg: FullPackage, destination: string, photo?: Photo) {
  let size = 48;
  let titleLines = doc.wrap(destination, CONTENT_WIDTH, size, false, "serif");
  while (titleLines.length > 3 && size > 28) {
    size -= 2;
    titleLines = doc.wrap(destination, CONTENT_WIDTH, size, false, "serif");
  }
  const subtitleLines = doc.wrap(pkg.title, CONTENT_WIDTH - 10, 9.5);
  const titleHeight = 22 + titleLines.length * (size + 2) + 15 + subtitleLines.length * 14;
  const titleTop = 686 - titleHeight;
  const imageBottom = titleTop - 26;
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, PAPER);
  doc.rect(0, 0, PAGE_WIDTH, 91, C.primary);
  drawBrandMark(doc, { y: 21, width: 116, dark: true });
  kicker(doc, "The group collection", PAGE_WIDTH - MARGIN - 170, 31, C.gold);
  doc.textAt(COMPANY.tagline, { x: PAGE_WIDTH - MARGIN - 170, y: 49, size: 8, color: C.white });

  if (photo) {
    drawImageCover(doc, photo.image, 0, 91, PAGE_WIDTH, imageBottom - 91);
    doc.scrim(0, imageBottom - 110, PAGE_WIDTH, 110, C.primary, 0.6);
  } else {
    doc.rect(0, 91, PAGE_WIDTH, imageBottom - 91, INK);
    doc.rule(imageBottom - 65, GOLD, MARGIN, 70, 2);
    doc.textAt("Journeys worth sharing.", { y: imageBottom - 49, size: 26, family: "serif", color: C.white });
  }
  const badge = `GROUP TOUR  /  ${packageGroupSize(pkg).toUpperCase()}`;
  const badgeWidth = doc.measure(badge, 7, true, 0.8) + 24;
  doc.rect(MARGIN, imageBottom - 41, badgeWidth, 24, C.gold);
  doc.textAt(badge, { x: MARGIN + 12, y: imageBottom - 33, size: 7, bold: true, charSpacing: 0.8, color: INK });

  let y = titleTop;
  kicker(doc, "Travel together. Remember forever.", MARGIN, y, MUTED);
  y += 22;
  for (const line of titleLines) {
    doc.textAt(line, { y, size, family: "serif", color: INK });
    y += size + 2;
  }
  y += 15;
  subtitleLines.forEach((line) => {
    doc.textAt(line, { y, size: 9.5, color: MUTED });
    y += 14;
  });

  doc.rule(705, GOLD);
  kicker(doc, "Your journey", MARGIN, 724);
  doc.textAt(pkg.duration, { y: 744, size: 13, bold: true, color: INK });
  kicker(doc, "Starting from / per person", MARGIN + 275, 724);
  let priceSize = 23;
  const price = withTaxMark(pkg.price) || "Enquire";
  while (doc.measure(price, priceSize, true) > CONTENT_WIDTH - 275 && priceSize > 10) priceSize -= 1;
  doc.textAt(price, { x: MARGIN + 275, y: 741, size: priceSize, bold: true, color: INK });
  doc.textAt(TAX_NOTE, { x: MARGIN + 275, y: 774, size: 7, color: MUTED });
  doc.rect(0, PAGE_HEIGHT - 35, PAGE_WIDTH, 35, C.primary);
  doc.textAt(`${COMPANY.phoneLabel}    /    ${COMPANY.email}    /    bandhantours.com`, { y: PAGE_HEIGHT - 22, size: 7, color: C.white });
}

function fact(doc: PdfDoc, label: string, value: string) {
  const lines = doc.wrap(value, CONTENT_WIDTH - 125, 9, true);
  const height = Math.max(38, lines.length * 14 + 18);
  doc.ensure(height);
  kicker(doc, label, MARGIN + 12, doc.y + 11);
  lines.forEach((line, index) => doc.textAt(line, { x: MARGIN + 125, y: doc.y + 10 + index * 14, size: 9, bold: true, color: INK }));
  doc.rule(doc.y + height, LINE);
  doc.y += height;
}

function pricePanel(doc: PdfDoc, pkg: FullPackage) {
  doc.ensure(166);
  const top = doc.y;
  doc.rect(MARGIN, top, CONTENT_WIDTH, 99, INK);
  kicker(doc, "Published starting price / per person", MARGIN + 20, top + 17, C.gold);
  let size = 29;
  const price = withTaxMark(pkg.price) || "Enquire";
  while (doc.measure(price, size, true) > CONTENT_WIDTH - 40 && size > 10) size -= 1;
  doc.textAt(price, { x: MARGIN + 20, y: top + 38, size, bold: true, color: C.white });
  doc.textAt(TAX_NOTE, { x: MARGIN + 20, y: top + 79, size: 7.5, color: C.white });
  doc.y += 114;
  copy(doc, "Published rates are indicative. Your consultant confirms departure availability, room configuration, applicable taxes and the final price before payment.", { size: 8, color: MUTED, gap: 22 });
}

function highlights(doc: PdfDoc, values: string[]) {
  const gap = 26;
  const width = (CONTENT_WIDTH - gap) / 2;
  for (let index = 0; index < values.length; index += 2) {
    const pair = values.slice(index, index + 2);
    const wrapped = pair.map((value) => doc.wrap(value, width - 32, BODY));
    const height = Math.max(...wrapped.map((lines) => lines.length * LEADING)) + 24;
    // Ordinary highlights stay together; unusually long admin copy flows.
    if (height > BOTTOM - 92) {
      pair.forEach((value, offset) => copy(doc, `${String(index + offset + 1).padStart(2, "0")}  ${value}`));
      continue;
    }
    doc.ensure(height);
    pair.forEach((_value, offset) => {
      const x = MARGIN + offset * (width + gap);
      doc.rule(doc.y, LINE, x, width);
      doc.textAt(String(index + offset + 1).padStart(2, "0"), { x, y: doc.y + 12, size: 10, family: "serif", color: GOLD });
      wrapped[offset].forEach((line, lineIndex) => doc.textAt(line, { x: x + 32, y: doc.y + 12 + lineIndex * LEADING, size: BODY, color: INK }));
    });
    doc.y += height;
  }
}

function itineraryDay(doc: PdfDoc, day: ItineraryDay) {
  const x = MARGIN + 62;
  const width = CONTENT_WIDTH - 62;
  const title = doc.wrap(day.title, width, 17, false, "serif");
  const paragraphs = (day.description || "").split(/\n\s*\n/).filter(Boolean);
  const bodyHeight = paragraphs.reduce((total, value) => total + doc.wrap(value, width, BODY).length * LEADING + 9, 0);
  const details = [
    day.meals && !/^(?:—|-|none)$/i.test(day.meals.trim()) ? `MEALS  ${day.meals}` : "",
    day.stay && !/^(?:—|-)$/i.test(day.stay.trim()) ? `OVERNIGHT  ${day.stay}` : "",
  ].filter(Boolean);
  const metaHeight = details.reduce((total, value) => total + doc.wrap(value, width - 24, 7.5, true).length * 12 + 4, 0);
  const headingHeight = title.length * 20 + 19;
  const fullHeight = headingHeight + bodyHeight + metaHeight + 35;
  doc.ensure(Math.min(fullHeight, headingHeight + 3 * LEADING + 20));
  // Keep ordinary days intact. A long day is allowed to continue, preserving
  // the entire description rather than silently truncating it to 11 lines.
  if (fullHeight <= BOTTOM - 92) doc.ensure(fullHeight);
  const top = doc.y;
  doc.rect(MARGIN, top, 43, 49, INK);
  doc.textAt(String(day.day).padStart(2, "0"), { x: MARGIN, y: top + 8, width: 43, align: "center", size: 23, family: "serif", color: C.white });
  doc.textAt("DAY", { x: MARGIN, y: top + 36, width: 43, align: "center", size: 6, bold: true, charSpacing: 1, color: C.gold });
  doc.rule(top, GOLD, x, width);
  doc.y += 12;
  title.forEach((line) => {
    doc.textAt(line, { x, y: doc.y, size: 17, family: "serif", color: INK });
    doc.y += 20;
  });
  doc.y += 7;
  paragraphs.forEach((value) => copy(doc, value, { x, width, gap: 9, color: /^Travel note:/i.test(value) ? MUTED : INK }));
  if (details.length) {
    doc.ensure(metaHeight + 16);
    doc.rect(x, doc.y, width, metaHeight + 12, hex("#EDEFE8"));
    doc.y += 8;
    details.forEach((value) => {
      doc.wrap(value, width - 24, 7.5, true).forEach((line) => {
        doc.textAt(line, { x: x + 12, y: doc.y, size: 7.5, bold: true, color: INK });
        doc.y += 12;
      });
      doc.y += 4;
    });
    doc.y += 4;
  }
  doc.y += 23;
}

/** Independent, page-aware columns keep long inclusion lists inside the page. */
function includedLists(doc: PdfDoc, inclusions: string[], exclusions: string[]) {
  const width = (CONTENT_WIDTH - 26) / 2;
  const startPage = doc.doc.getPageCount() - 1;
  const startY = doc.y;
  const endings: { page: number; y: number }[] = [];
  [inclusions, exclusions].forEach((values, column) => {
    let pageIndex = startPage;
    let y = startY;
    const x = MARGIN + column * (width + 26);
    const accent = column === 0 ? C.green : C.accentDark;
    const heading = (continued = false) => {
      doc.rule(y, accent, x, width, 2);
      kicker(doc, `${column === 0 ? "Included" : "Not included"}${continued ? " / continued" : ""}`, x, y + 13, accent);
      y += 39;
    };
    const next = () => {
      pageIndex += 1;
      if (pageIndex >= doc.doc.getPageCount()) doc.addPage();
      doc.page = doc.doc.getPage(pageIndex);
      y = 92;
      heading(true);
    };
    doc.page = doc.doc.getPage(pageIndex);
    heading();
    for (const value of values) {
      const lines = doc.wrap(formatPriceText(value), width - 16, 8.5);
      if (y + Math.min(lines.length, 3) * 13 + 9 > BOTTOM) next();
      doc.rect(x, y + 3, 4, 4, accent);
      for (const line of lines) {
        if (y + 13 > BOTTOM) next();
        doc.textAt(line, { x: x + 16, y, size: 8.5, color: INK });
        y += 13;
      }
      y += 7;
    }
    endings.push({ page: pageIndex, y });
  });
  const lastPage = Math.max(...endings.map((ending) => ending.page));
  doc.page = doc.doc.getPage(lastPage);
  doc.y = Math.max(...endings.filter((ending) => ending.page === lastPage).map((ending) => ending.y)) + 15;
}

function closing(doc: PdfDoc) {
  doc.ensure(216);
  const top = doc.y;
  doc.rect(MARGIN, top, CONTENT_WIDTH, 172, INK);
  doc.rect(MARGIN, top, 4, 172, C.gold);
  kicker(doc, "Your next journey starts here", MARGIN + 22, top + 20, C.gold);
  doc.textAt("Let's travel together.", { x: MARGIN + 22, y: top + 42, size: 29, family: "serif", color: C.white });
  doc.textAt(COMPANY.phoneLabel, { x: MARGIN + 22, y: top + 87, size: 17, bold: true, color: C.white });
  doc.textAt(`${COMPANY.email}    /    bandhantours.com`, { x: MARGIN + 22, y: top + 116, size: 9, color: C.white });
  doc.textAt("Ask our reservations team about dates, rooms and availability.", { x: MARGIN + 22, y: top + 144, size: 8, color: C.white });
  doc.y = top + 190;
  copy(doc, COMPANY.address, { size: 8, color: MUTED, gap: 0 });
}

/** The public, reusable group-tour catalogue design. Personal quotes remain separate. */
export async function renderGroupTourBrochurePdf(pkg: FullPackage): Promise<Uint8Array> {
  const doc = await PdfDoc.create();
  const destination = packageDestinationLabel(pkg);
  doc.doc.setTitle(`${pkg.title} | Bandhan Tours Group Collection`);
  doc.doc.setAuthor(COMPANY.name);
  doc.doc.setSubject(`${pkg.duration} group tour itinerary, departures and inclusions`);
  doc.doc.setLanguage("en-IN");
  doc.contentBottom = BOTTOM;
  let section = "The journey";
  const sections: string[] = [];
  doc.onNewPage = (current, index) => {
    sections[index] = section;
    chrome(current, destination, section);
  };

  const sources = [
    { source: pkg.heroImage || pkg.image, caption: destination },
    ...(pkg.gallery || []).filter((item) => !item.placeholder).map((item) => ({ source: item.image, caption: item.caption || destination })),
  ].filter((item, index, all) => item.source && all.findIndex((other) => other.source === item.source) === index).slice(0, 4);
  const loaded = await Promise.all(sources.map(async (item) => {
    const image = await loadProposalImage(doc, item.source);
    return image ? { image, caption: item.caption } : null;
  }));
  const photos = loaded.filter((item): item is Photo => item !== null);
  cover(doc, pkg, destination, photos[0]);

  doc.addPage();
  chapter(doc, "01", "The journey", "Good company. Great places.");
  copy(doc, pkg.overview || pkg.tagline || pkg.title, { size: 10, gap: 20 });
  fact(doc, "Duration", pkg.duration);
  fact(doc, "Group size", packageGroupSize(pkg));
  fact(doc, "Starts from", pkg.startingPoint || "Confirm with our reservations team");
  fact(doc, "Best time", pkg.bestTime || "Confirm with our reservations team");
  doc.y += 24;
  const route = (pkg.itinerary || []).map((day) => day.stay?.trim()).filter((stay): stay is string => Boolean(stay && !/^(?:—|-)$/.test(stay)));
  const stops = route.filter((stay, index) => index === 0 || stay !== route[index - 1]);
  if (stops.length) {
    doc.ensure(70);
    kicker(doc, "Your overnight route", MARGIN, doc.y, MUTED);
    doc.y += 17;
    copy(doc, stops.join("  →  "), { size: 10, bold: true, gap: 20 });
  }
  const dates = upcomingPackageDates(pkg.departureDates);
  if (dates.length) {
    doc.ensure(70);
    kicker(doc, "Published departures", MARGIN, doc.y, MUTED);
    doc.y += 18;
    dates.forEach((date) => copy(doc, formatPackageDate(date), { size: 9, gap: 5 }));
    copy(doc, "Availability is confirmed by our reservations team before booking.", { size: 8, color: MUTED });
  }
  pricePanel(doc, pkg);

  if (pkg.highlights?.length) {
    section = "Journey highlights";
    doc.addPage();
    chapter(doc, "02", "The experiences", "Look forward to this.");
    const photo = photos[1] || photos[0];
    if (photo) {
      const columnWidth = (CONTENT_WIDTH - 26) / 2 - 32;
      let listHeight = 0;
      for (let index = 0; index < pkg.highlights.length; index += 2) {
        listHeight += Math.max(...pkg.highlights.slice(index, index + 2).map((value) => doc.wrap(value, columnWidth, BODY).length * LEADING)) + 24;
      }
      const photoHeight = Math.min(185, Math.max(100, BOTTOM - doc.y - listHeight - 40));
      drawImageCover(doc, photo.image, MARGIN, doc.y, CONTENT_WIDTH, photoHeight);
      doc.y += photoHeight + 9;
      copy(doc, photo.caption, { size: 7, color: MUTED, gap: 19 });
    }
    highlights(doc, pkg.highlights);
  }

  if (pkg.itinerary?.length) {
    section = "Day-by-day itinerary";
    doc.addPage();
    chapter(doc, "03", `${pkg.itinerary.length} days / the itinerary`, "Every day, a new discovery.");
    pkg.itinerary.forEach((day) => itineraryDay(doc, day));
  }

  section = "Prices & inclusions";
  doc.addPage();
  chapter(doc, "04", "The details", "Know what's in your journey.");
  includedLists(doc, pkg.inclusions?.length ? pkg.inclusions : ["Confirmed in your final written quotation."], pkg.exclusions?.length ? pkg.exclusions : ["Anything not expressly listed as included."]);

  if (pkg.faqs?.length) {
    section = "Travel notes & booking terms";
    doc.addPage();
    chapter(doc, "05", "Before you book", "A little preparation goes a long way.");
    for (const faq of pkg.faqs) {
      const height = doc.wrap(faq.question, CONTENT_WIDTH, 11, true).length * 16;
      const answerHeight = doc.wrap(formatPriceText(faq.answer), CONTENT_WIDTH, BODY).length * LEADING;
      const blockHeight = height + answerHeight + 34;
      doc.ensure(blockHeight <= BOTTOM - 92 ? blockHeight : height + 62);
      doc.rule(doc.y, LINE);
      doc.y += 14;
      copy(doc, faq.question, { size: 11, bold: true, gap: 8 });
      copy(doc, formatPriceText(faq.answer), { size: BODY, gap: 12 });
    }
  }

  section = "Plan your departure";
  doc.addPage();
  chapter(doc, "06", "Travel with Bandhan", "Make room for new memories.");
  const photo = photos[2] || photos[1] || photos[0];
  if (photo) {
    drawImageCover(doc, photo.image, MARGIN, doc.y, CONTENT_WIDTH, 145);
    doc.y += 154;
    copy(doc, photo.caption, { size: 7, color: MUTED, gap: 22 });
  }
  [
    ["01", "Choose your departure", "Share your preferred dates, departure city and traveller count."],
    ["02", "Review your trip", "Your consultant confirms availability, rooms, services and the final written quotation."],
    ["03", "Confirm your booking", "Review the payment schedule and applicable booking terms with your consultant."],
  ].forEach(([number, title, description]) => {
    doc.ensure(66);
    doc.textAt(number, { y: doc.y, size: 20, family: "serif", color: GOLD });
    copy(doc, title, { x: MARGIN + 40, width: CONTENT_WIDTH - 40, size: 10, bold: true, gap: 4 });
    copy(doc, description, { x: MARGIN + 40, width: CONTENT_WIDTH - 40, size: 8.5, color: MUTED, gap: 15 });
  });
  closing(doc);

  // Paint footers last, after the final page count is known.
  const count = doc.doc.getPageCount();
  doc.doc.getPages().forEach((page, index) => {
    if (index === 0) return;
    doc.page = page;
    doc.rule(792, LINE);
    doc.textAt("BANDHAN TOURS  /  GROUP COLLECTION", { y: 807, size: 6, bold: true, charSpacing: 0.8, color: MUTED });
    doc.textAt(`${sections[index] || section}    /    ${String(index + 1).padStart(2, "0")} - ${String(count).padStart(2, "0")}`, { y: 806, width: CONTENT_WIDTH, align: "right", size: 6.5, color: MUTED });
    doc.textAt("bandhantours.com", { y: 822, size: 6, color: MUTED });
  });
  return doc.save();
}
