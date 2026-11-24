import { PDFString, type PDFImage } from "pdf-lib";
import type { FullPackage } from "@/data/packageDetails";
import type { ItineraryDay } from "@/data/mockData";
import { COMPANY } from "@/lib/email/company";
import { packageDestinationLabel, packageGroupSize } from "@/lib/packageCategory";
import { formatPackageDate, upcomingPackageDates } from "@/lib/packageDates";
import { formatPriceText, TAX_NOTE, withTaxMark } from "@/lib/priceLabel";
import { C, drawBrandMark } from "./pdf/chrome";
import { drawImageCover, loadProposalImage } from "./pdf/images";
import { CONTENT_WIDTH, hex, MARGIN, PAGE_HEIGHT, PAGE_WIDTH, PdfDoc } from "./pdf/layout";

const PAPER = hex("#F8F5EE");
const INK = hex("#112E32");
const MUTED = hex("#596A68");
const LINE = hex("#D6DBD3");
const ACCENT = hex("#D65E3D");
const CHAMPAGNE = hex("#DAB876");
const BOTTOM = 762;
const BODY = 11;
const LEADING = 16;

type Photo = { image: PDFImage; caption: string };

// Stable, destination-specific fallbacks for the two brochure sample routes.
// Admin-uploaded imagery remains first in the source list.
const LOCAL_PHOTOS: Record<string, { source: string; caption: string }[]> = {
  "sikkim-darjeeling-6n": [
    { source: "/pdf-assets/kanchenjunga-darjeeling.jpg", caption: "Kangchenjunga, seen from Darjeeling" },
    { source: "/pdf-assets/tsomgo-lake.jpg", caption: "Tsomgo Lake, Sikkim" },
    { source: "/pdf-assets/darjeeling-railway.jpg", caption: "Darjeeling Himalayan Railway" },
  ],
  "singapore-malaysia-thailand": [
    { source: "/pdf-assets/singapore-marina-bay.jpg", caption: "Marina Bay, Singapore" },
    { source: "/pdf-assets/kuala-lumpur-skyline.jpg", caption: "Kuala Lumpur, Malaysia" },
    { source: "/pdf-assets/bangkok-chinatown.jpg", caption: "Bangkok, Thailand" },
  ],
};

function copy(doc: PdfDoc, value: string, options: { x?: number; width?: number; size?: number; bold?: boolean; color?: ReturnType<typeof hex>; gap?: number; leading?: number } = {}) {
  doc.paragraph(value, {
    x: options.x ?? MARGIN,
    maxWidth: options.width ?? CONTENT_WIDTH,
    size: options.size ?? BODY,
    lineHeight: options.leading ?? (options.size ?? BODY) + 5,
    color: options.color ?? INK,
    bold: options.bold,
    spaceAfter: options.gap ?? 10,
  });
}

function kicker(doc: PdfDoc, value: string, x: number, y: number, color = MUTED) {
  doc.textAt(value.toUpperCase(), { x, y, size: 8.5, bold: true, charSpacing: .65, color });
}

function chapter(doc: PdfDoc, number: string, eyebrow: string, title: string) {
  const lines = doc.wrap(title, CONTENT_WIDTH, 31, false, "serif");
  doc.ensure(39 + lines.length * 36);
  kicker(doc, `${number} / ${eyebrow}`, MARGIN, doc.y, ACCENT);
  doc.y += 22;
  for (const line of lines) {
    doc.textAt(line, { y: doc.y, size: 31, family: "serif", color: INK });
    doc.y += 36;
  }
  doc.y += 17;
}

function chrome(doc: PdfDoc, destination: string) {
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, PAPER);
  kicker(doc, "Bandhan Tours", MARGIN, 28, INK);
  const available = CONTENT_WIDTH - 150;
  let size = 9;
  while (doc.measure(destination, size, true) > available && size > 5) size -= 0.25;
  doc.textAt(destination, { x: MARGIN + 150, y: 28, width: available, align: "right", size, color: MUTED });
  doc.rule(51, LINE);
  doc.y = 76;
}

function brochureLink(doc: PdfDoc, x: number, top: number, width: number, height: number, url: string) {
  const annotation = doc.doc.context.obj({
    Type: "Annot", Subtype: "Link", Rect: [x, PAGE_HEIGHT - top - height, x + width, PAGE_HEIGHT - top],
    Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: PDFString.of(url) },
  });
  doc.page.node.addAnnot(doc.doc.context.register(annotation));
}

function cover(doc: PdfDoc, pkg: FullPackage, destination: string, photo?: Photo) {
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, PAPER);
  doc.rect(0, 0, PAGE_WIDTH, 682, INK);
  if (photo) {
    drawImageCover(doc, photo.image, 0, 0, PAGE_WIDTH, 682);
    doc.scrim(0, 0, PAGE_WIDTH, 190, INK, .74, "top");
    doc.scrim(0, 190, PAGE_WIDTH, 492, INK, .94);
  }
  drawBrandMark(doc, { y: 31, width: 116, dark: true });
  kicker(doc, "The group collection", PAGE_WIDTH - MARGIN - 176, 40, C.white);
  doc.textAt(COMPANY.tagline, { x: PAGE_WIDTH - MARGIN - 176, y: 58, size: 7.6, color: C.white });
  doc.rule(104, C.white, MARGIN, CONTENT_WIDTH, .5);

  const title = destination.replace(/,\s*/g, "\n").replace(/\s*&\s*/g, "\n& ");
  let size = 73;
  let lines = doc.wrap(title, CONTENT_WIDTH, size, false, "serif");
  while ((lines.length > 3 || lines.some(line => doc.measure(line, size, false, 0, "serif") > CONTENT_WIDTH)) && size > 22) {
    size -= 1;
    lines = doc.wrap(title, CONTENT_WIDTH, size, false, "serif");
  }
  const lineHeight = size * 1.02;
  const titleTop = 562 - lines.length * lineHeight;
  kicker(doc, `${packageGroupSize(pkg)} / one shared adventure`, MARGIN, titleTop - 28, CHAMPAGNE);
  lines.forEach((line, index) => doc.textAt(line, { y: titleTop + index * lineHeight, size, family: "serif", color: C.white }));
  doc.rule(580, CHAMPAGNE, MARGIN, 46, 2);
  doc.textAt("Extraordinary places. Shared memories.", { y: 599, size: 14, color: C.white, family: "serif" });
  kicker(doc, "Explore the journey", MARGIN, 650, C.white);
  doc.textAt("01 / THE GROUP COLLECTION", { x: MARGIN + 280, y: 650, width: CONTENT_WIDTH - 280, align: "right", size: 6.5, color: C.white });

  kicker(doc, "Your time away", MARGIN, 708);
  doc.textAt(pkg.duration, { y: 731, size: 13, bold: true, color: INK });
  kicker(doc, "From / per person", MARGIN + 282, 708);
  const price = withTaxMark(pkg.price) || "Enquire";
  let priceSize = 27;
  while (doc.measure(price, priceSize, true) > CONTENT_WIDTH - 282 && priceSize > 10) priceSize -= 1;
  doc.textAt(price, { x: MARGIN + 282, y: 727, size: priceSize, bold: true, color: INK });
  doc.textAt(TAX_NOTE, { x: MARGIN + 282, y: 761, size: 6.7, color: MUTED });
  doc.rule(789, LINE);
  doc.textAt("BANDHANTOURS.COM", { y: 808, size: 7, bold: true, charSpacing: 1, color: INK });
  doc.textAt(COMPANY.phoneLabel, { y: 808, width: CONTENT_WIDTH, align: "right", size: 8, color: INK });
  brochureLink(doc, MARGIN, 800, 180, 24, `${COMPANY.website}/packages/${encodeURIComponent(pkg.id)}`);
  brochureLink(doc, PAGE_WIDTH - MARGIN - 180, 800, 180, 24, COMPANY.phoneHref);
}

function routeDiagram(doc: PdfDoc, pkg: FullPackage) {
  const stops: { name: string; nights: number }[] = [];
  for (const day of pkg.itinerary || []) {
    const name = day.stay?.trim();
    if (!name || /^(?:—|-)$/.test(name)) continue;
    const previous = stops[stops.length - 1];
    if (previous?.name === name) previous.nights += 1;
    else stops.push({ name, nights: 1 });
  }
  if (!stops.length) return;
  const columns = Math.min(stops.length, 4), width = CONTENT_WIDTH / columns;
  doc.ensure(110);
  kicker(doc, "The overnight route", MARGIN, doc.y, ACCENT);
  doc.y += 26;
  for (let i = 0; i < stops.length; i += columns) {
    const row = stops.slice(i, i + columns);
    const height = Math.max(...row.map(stop => doc.wrap(stop.name, width - 20, 11, true).length)) * 15 + 51;
    doc.ensure(height);
    const top = doc.y;
    row.forEach((stop, offset) => {
      const x = MARGIN + offset * width;
      doc.rule(top, LINE, x, width);
      doc.rect(x, top - 2, 5, 5, ACCENT);
      doc.textAt(String(i + offset + 1).padStart(2, "0"), { x, y: top + 13, size: 7, color: ACCENT });
      const lines = doc.wrap(stop.name, width - 20, 11, true);
      lines.forEach((line, n) => doc.textAt(line, { x, y: top + 29 + n * 15, size: 11, bold: true, color: INK }));
      doc.textAt(`${stop.nights} ${stop.nights === 1 ? "night" : "nights"}`, { x, y: top + 32 + lines.length * 15, size: 8, color: MUTED });
    });
    doc.y += height + 15;
  }
}

function photoStrip(doc: PdfDoc, photos: Photo[], height: number) {
  if (!photos.length) return;
  doc.ensure(height + 25);
  const visible = photos.slice(0, 2), gap = 10;
  const firstWidth = visible.length === 2 ? CONTENT_WIDTH * .62 : CONTENT_WIDTH;
  visible.forEach((photo, i) => {
    const x = i === 0 ? MARGIN : MARGIN + firstWidth + gap;
    const width = i === 0 ? firstWidth : CONTENT_WIDTH - firstWidth - gap;
    drawImageCover(doc, photo.image, x, doc.y, width, height);
    doc.scrim(x, doc.y + height - 55, width, 55, INK, .85);
    const caption = doc.wrap(photo.caption, width - 22, 8);
    caption.forEach((line, n) => doc.textAt(line, { x: x + 11, y: doc.y + height - 12 - (caption.length - n) * 11, size: 8, color: C.white }));
  });
  doc.y += height + 25;
}

function fact(doc: PdfDoc, label: string, value: string) {
  const lines = doc.wrap(value, CONTENT_WIDTH - 125, 10.5);
  const height = Math.max(42, lines.length * 15 + 22);
  doc.ensure(height);
  doc.textAt(label, { x: MARGIN, y: doc.y + 12, size: 10.5, bold: true, color: MUTED });
  lines.forEach((line, index) => doc.textAt(line, { x: MARGIN + 125, y: doc.y + 12 + index * 15, size: 10.5, color: INK }));
  doc.rule(doc.y + height, LINE);
  doc.y += height;
}

function highlights(doc: PdfDoc, values: string[]) {
  const gap = 26;
  const width = (CONTENT_WIDTH - gap) / 2;
  for (let index = 0; index < values.length; index += 2) {
    const pair = values.slice(index, index + 2);
    const wrapped = pair.map((value) => doc.wrap(value, width - 22, 10.5));
    const height = Math.max(...wrapped.map((lines) => lines.length * 15.5)) + 22;
    // Ordinary highlights stay together; unusually long admin copy flows.
    if (height > BOTTOM - 92) {
      pair.forEach((value, offset) => copy(doc, `${String(index + offset + 1).padStart(2, "0")}  ${value}`));
      continue;
    }
    doc.ensure(height);
    pair.forEach((_value, offset) => {
      const x = MARGIN + offset * (width + gap);
      doc.rule(doc.y, LINE, x, width);
      doc.textAt(String(index + offset + 1).padStart(2, "0"), { x, y: doc.y + 11, size: 8, bold: true, color: ACCENT });
      wrapped[offset].forEach((line, lineIndex) => doc.textAt(line, { x: x + 22, y: doc.y + 11 + lineIndex * 15.5, size: 10.5, color: INK }));
    });
    doc.y += height;
  }
}

// Measure and draw from the same line boxes. A block's reserved height is
// exactly its drawn height, including headings, metadata and paragraph gaps.
type LineBox = { text: string; size: number; leading: number; bold?: boolean; color?: ReturnType<typeof hex> };
type FlowBox = LineBox | { gap: number };
function lineBoxes(doc: PdfDoc, text: string, width: number, size: number, leading: number, bold = false, color = INK): FlowBox[] {
  return doc.wrap(text, width, size, bold).map(text => ({ text, size, leading, bold, color }));
}
function blockHeight(boxes: FlowBox[]) { return boxes.reduce((sum, box) => sum + ('gap' in box ? box.gap : box.leading), 0); }
function drawBoxes(doc: PdfDoc, boxes: FlowBox[], x: number) {
  boxes.forEach(box => {
    const h = 'gap' in box ? box.gap : box.leading;
    if ('gap' in box) { doc.y = Math.min(BOTTOM, doc.y + h); return; }
    doc.ensure(h);
    doc.textAt(box.text, { x, y: doc.y, size: box.size, bold: box.bold, color: box.color ?? INK });
    doc.y += h;
  });
}

/** Prefer complete, evenly filled pages over isolated final blocks. */
function pageGroups(heights: number[], firstCapacity: number, laterCapacity: number): number[][] {
  const memo = new Map<string, { cost: number; groups: number[][] }>();
  const solve = (start: number, first: boolean): { cost: number; groups: number[][] } => {
    if (start === heights.length) return { cost: 0, groups: [] };
    const key = `${start}/${first}`;
    const cached = memo.get(key); if (cached) return cached;
    const capacity = first ? firstCapacity : laterCapacity;
    let best = { cost: Infinity, groups: [] as number[][] }, used = 0;
    for (let end = start; end < heights.length; end++) {
      used += heights[end];
      if (used > capacity && end > start) break;
      const rest = solve(end + 1, false);
      const unused = Math.max(0, capacity - used);
      const cost = 10000000 + unused * unused + (end === start ? 250000 : 0) + rest.cost;
      if (cost < best.cost) best = { cost, groups: [Array.from({ length: end-start+1 }, (_, i) => start+i), ...rest.groups] };
      if (used > capacity) break;
    }
    memo.set(key, best); return best;
  };
  return solve(0, true).groups;
}

function dayLayout(doc: PdfDoc, day: ItineraryDay) {
  const width = CONTENT_WIDTH - 50;
  const distanceMatch = day.title.match(/\s*(\([^()]*\b(?:km|hrs?|hours?)\b[^()]*\))\s*$/i);
  const title = distanceMatch ? day.title.slice(0, distanceMatch.index).trim() : day.title;
  const boxes: FlowBox[] = [{ gap: 16 }, ...lineBoxes(doc, title, width, 15.5, 20, true)];
  if (distanceMatch) boxes.push({ gap: 5 }, ...lineBoxes(doc, distanceMatch[1], width, 9.5, 13, false, MUTED));
  boxes.push({ gap: 10 });
  for (const value of (day.description || '').split(/\n\s*\n/).filter(Boolean)) {
    const note = /^Travel note:/i.test(value);
    boxes.push(...lineBoxes(doc, value, width, note ? 9.5 : BODY, note ? 14 : LEADING, false, note ? MUTED : INK), { gap: 9 });
  }
  const details = [
    day.meals && !/^(?:—|-|none)$/i.test(day.meals.trim()) ? `Meals: ${day.meals}` : '',
    day.stay && !/^(?:—|-)$/i.test(day.stay.trim()) ? `Stay: ${day.stay}` : '',
  ].filter(Boolean);
  boxes.push(...lineBoxes(doc, details.join('   |   '), width, 9.5, 14, true), { gap: 20 });
  return boxes;
}

function itineraryDay(doc: PdfDoc, day: ItineraryDay) {
  const x = MARGIN + 50;
  const boxes = dayLayout(doc, day);
  const height = blockHeight(boxes);
  doc.ensure(height <= BOTTOM - 76 ? height : 120);
  const top = doc.y;
  doc.rule(top, LINE);
  doc.textAt('DAY', { y: top + 18, size: 8.5, bold: true, color: MUTED, charSpacing: .6 });
  doc.textAt(String(day.day).padStart(2, '0'), { y: top + 34, size: 29, color: ACCENT, bold: true });
  drawBoxes(doc, boxes, x);
}

/** Two reading columns, filled in order and balanced for the final page.
 * Headings stay with an item; exceptionally long admin items continue safely. */
function balancedIncludedLists(doc: PdfDoc, inclusions: string[], exclusions: string[]) {
  const gap = 32;
  const width = (CONTENT_WIDTH - gap) / 2;
  const textWidth = width - 14;
  const size = 10.5;
  const leading = 15;
  const headingHeight = 41;
  const itemGap = 12;
  const continuationTop = 76;
  const groups = [
    { title: "Included in your trip", continued: "Included / continued", values: inclusions, color: INK, marker: "+" },
    { title: "Not included", continued: "Not included / continued", values: exclusions, color: ACCENT, marker: "-" },
  ];
  // Ordinary words use the document's wrapping. Split only an exceptionally
  // long token, so arbitrary admin copy also remains inside the column edge.
  const wrap = (value: string) => doc.wrap(formatPriceText(value), textWidth, size).flatMap(line => {
    if (doc.measure(line, size) <= textWidth) return [line];
    const result: string[] = [];
    let part = "";
    for (const char of line) {
      if (part && doc.measure(part + char, size) > textWidth) {
        result.push(part); part = "";
      }
      part += char;
    }
    if (part) result.push(part);
    return result.length ? result : [""];
  });
  const items = groups.flatMap((group, groupIndex) => group.values.map((value, groupItem) => ({
    groupIndex, groupItem, lines: wrap(value),
  })));
  if (!items.length) return;

  type Cursor = { item: number; line: number };
  type Fragment = { item: number; from: number; to: number; y: number; heading?: { text: string; y: number } };
  type Column = { fragments: Fragment[]; end: Cursor; height: number };
  const finished = (cursor: Cursor) => cursor.item >= items.length;

  // One planner owns both measurement and drawing. It never creates pages;
  // the caller first fills left then right, and only then advances the page.
  const planColumn = (start: Cursor, capacity: number, fullCapacity: number): Column => {
    const cursor = { ...start };
    const fragments: Fragment[] = [];
    let used = 0;
    let activeGroup = -1;
    while (!finished(cursor)) {
      const item = items[cursor.item];
      const group = groups[item.groupIndex];
      const newHeading = activeGroup !== item.groupIndex;
      const overhead = newHeading ? headingHeight : 0;
      const remaining = item.lines.length - cursor.line;
      const minimumLines = Math.min(2, remaining);
      if (used + overhead + minimumLines * leading > capacity) break;
      const availableLines = Math.floor((capacity - used - overhead) / leading);
      // Keep a normal item intact. Only an item taller than an entire column
      // may split, and every continuation receives the correct list heading.
      if (remaining > availableLines && remaining * leading + headingHeight <= fullCapacity) break;
      let take = Math.min(remaining, availableLines);
      if (remaining - take === 1 && take > 2) take -= 1;
      const heading = newHeading ? {
        text: item.groupItem === 0 && cursor.line === 0 ? group.title : group.continued,
        y: used,
      } : undefined;
      used += overhead;
      fragments.push({ item: cursor.item, from: cursor.line, to: cursor.line + take, y: used, heading });
      used += take * leading;
      activeGroup = item.groupIndex;
      cursor.line += take;
      if (cursor.line === item.lines.length) {
        cursor.item += 1; cursor.line = 0;
        // Trailing whitespace is bounded and does not create a blank page.
        used = Math.min(capacity, used + itemGap);
      } else {
        break;
      }
    }
    return { fragments, end: cursor, height: used };
  };

  let cursor: Cursor = { item: 0, line: 0 };
  while (!finished(cursor)) {
    let top = doc.y;
    let capacity = BOTTOM - top;
    if (capacity < headingHeight + 2 * leading) {
      doc.addPage(); doc.y = continuationTop;
      top = continuationTop; capacity = BOTTOM - top;
    }
    let left = planColumn(cursor, capacity, capacity);
    let right = planColumn(left.end, capacity, capacity);
    if (!left.fragments.length && !right.fragments.length) {
      // The remaining first-page space can be too shallow for a normal item;
      // start a full page, where even an extreme item can split safely.
      doc.addPage(); doc.y = continuationTop;
      continue;
    }
    if (finished(right.end)) {
      // Find the shortest equal-height columns which contain the remainder.
      // This balances the final page while preserving sequential reading.
      let low = headingHeight + leading;
      let high = capacity;
      for (let pass = 0; pass < 14; pass += 1) {
        const target = (low + high) / 2;
        const a = planColumn(cursor, target, capacity);
        const b = planColumn(a.end, target, capacity);
        if (finished(b.end)) high = target;
        else low = target;
      }
      const target = Math.min(capacity, Math.ceil(high * 10) / 10);
      left = planColumn(cursor, target, capacity);
      right = planColumn(left.end, target, capacity);
    }
    [left, right].forEach((column, index) => {
      const x = MARGIN + index * (width + gap);
      for (const fragment of column.fragments) {
        const item = items[fragment.item];
        const group = groups[item.groupIndex];
        if (fragment.heading) {
          const y = top + fragment.heading.y;
          doc.textAt(fragment.heading.text, { x, y, size: 12, bold: true, color: group.color });
          doc.rule(y + 25, LINE, x, width);
        }
        if (fragment.from === 0) doc.textAt(group.marker, { x, y: top + fragment.y, size: 11, bold: true, color: group.color });
        item.lines.slice(fragment.from, fragment.to).forEach((line, i) => {
          doc.textAt(line, { x: x + 14, y: top + fragment.y + i * leading, size, color: INK });
        });
      }
    });
    cursor = right.end;
    doc.y = top + Math.max(left.height, right.height);
    if (!finished(cursor)) {
      doc.addPage(); doc.y = continuationTop;
    }
  }
}

function bookingInformation(doc: PdfDoc, faqs: FullPackage['faqs']) {
  // Keep financial labels and amounts aligned. Ordinary prose remains prose.
  const prepared = faqs.map(faq => {
    const question = doc.wrap(faq.question, CONTENT_WIDTH, 13, true);
    type AnswerLine = { text?: string; label?: string; value?: string; heading?: boolean; height: number };
    const answer: AnswerLine[] = formatPriceText(faq.answer).split('\n').map(line => {
      if (!line.trim()) return { height: 8 };
      const pair = line.match(/^\s*[•-]\s*(.+?:)\s*(.+)$/);
      if (pair) {
        const labelLines = doc.wrap(pair[1], 265, 10.5);
        const valueLines = doc.wrap(pair[2], CONTENT_WIDTH - 305, 10.5, true);
        return { label: pair[1], value: pair[2], height: Math.max(labelLines.length, valueLines.length) * 15 + 15 };
      }
      const heading = /:\s*$/.test(line) && line.length < 85;
      return { text: line, heading, height: doc.wrap(line, CONTENT_WIDTH, 10.5, heading).length * 15 + (heading ? 10 : 8) };
    });
    const height = question.length * 18 + 32 + answer.reduce((sum, row) => sum + row.height, 0) + 24;
    return { question, answer, height };
  });
  const groups = pageGroups(prepared.map(item => item.height), BOTTOM - doc.y, BOTTOM - 151);
  for (let group = 0; group < groups.length; group++) {
    if (group) {
      doc.addPage();
      chapter(doc, '05', 'Before you travel / continued', 'Booking information');
    }
    for (const index of groups[group]) {
    const { question, answer, height } = prepared[index];
    doc.ensure(height <= BOTTOM - 76 ? height : question.length * 18 + 90);
    doc.rule(doc.y, LINE); doc.y += 18;
    question.forEach(line => { doc.textAt(line, { y: doc.y, size: 13, bold: true, color: INK }); doc.y += 18; });
    doc.y += 14;
    for (const row of answer) {
      if (row.label !== undefined) {
        doc.ensure(row.height);
        const top = doc.y;
        doc.rect(MARGIN, top - 5, CONTENT_WIDTH, row.height - 2, hex('#EDEFE8'));
        doc.wrap(row.label, 265, 10.5).forEach((line, i) => doc.textAt(line, { x: MARGIN + 10, y: top + i * 15, size: 10.5, color: INK }));
        doc.wrap(row.value!, CONTENT_WIDTH - 305, 10.5, true).forEach((line, i) => doc.textAt(line, { x: MARGIN + 285, y: top + i * 15, size: 10.5, bold: true, color: INK }));
        doc.y += row.height;
      } else if (row.text) {
        drawBoxes(doc, [...lineBoxes(doc, row.text, CONTENT_WIDTH, 10.5, 15, row.heading), { gap: row.heading ? 10 : 8 }], MARGIN);
      } else doc.y += row.height;
    }
    doc.y += 24;
    }
  }
}

function closing(doc: PdfDoc, destination: string, photo?: Photo) {
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, INK);
  if (photo) {
    drawImageCover(doc, photo.image, 0, 0, PAGE_WIDTH, 426);
    doc.scrim(0, 236, PAGE_WIDTH, 190, INK, 1);
  }
  drawBrandMark(doc, { y: 30, width: 112, dark: true });
  kicker(doc, "There is a whole world to share.", MARGIN, 445, CHAMPAGNE);
  doc.textAt("Shall we go?", { y: 476, size: 65, family: "serif", color: C.white });
  const lines = doc.wrap(`Your ${destination} journey starts with a conversation.`, CONTENT_WIDTH - 20, 12);
  lines.forEach((line, i) => doc.textAt(line, { y: 557 + i * 17, size: 12, color: C.white }));
  const buttonY = 617 + Math.max(0, lines.length - 2) * 17;
  doc.rect(MARGIN, buttonY, 220, 43, CHAMPAGNE);
  doc.textAt("PLAN MY DEPARTURE  >", { x: MARGIN + 18, y: buttonY + 17, size: 8, bold: true, charSpacing: .5, color: INK });
  brochureLink(doc, MARGIN, buttonY, 220, 43, COMPANY.whatsappHref);
  const contactY = buttonY + 69;
  doc.textAt(COMPANY.phoneLabel, { y: contactY, size: 20, bold: true, color: C.white });
  brochureLink(doc, MARGIN, contactY - 6, 265, 30, COMPANY.phoneHref);
  doc.textAt(`${COMPANY.email}   /   bandhantours.com`, { y: contactY + 34, size: 9, color: C.white });
  brochureLink(doc, MARGIN, contactY + 30, 165, 20, `mailto:${COMPANY.email}`);
  brochureLink(doc, MARGIN + 175, contactY + 30, 180, 20, COMPANY.website);
  doc.wrap(COMPANY.address, CONTENT_WIDTH - 35, 7.5).forEach((line, i) => doc.textAt(line, { y: contactY + 68 + i * 12, size: 7.5, color: C.white }));
  doc.rule(800, CHAMPAGNE);
  doc.textAt(COMPANY.tagline, { y: 817, size: 8, family: "serif", color: CHAMPAGNE });
}

/** The public, reusable group-tour catalogue design. Personal quotes remain separate. */
export async function renderGroupTourBrochurePdf(pkg: FullPackage): Promise<Uint8Array> {
  const doc = await PdfDoc.create({ editorial: true });
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
    chrome(current, destination);
  };

  const sources = [
    { source: pkg.heroImage || pkg.image, caption: destination },
    ...(pkg.gallery || []).filter((item) => !item.placeholder).map((item) => ({ source: item.image, caption: item.caption || destination })),
    ...(LOCAL_PHOTOS[pkg.id] || []),
  ].filter((item, index, all) => item.source && all.findIndex((other) => other.source === item.source) === index).slice(0, 7);
  const loaded = await Promise.all(sources.map(async (item) => {
    const image = await loadProposalImage(doc, item.source);
    return image ? { image, caption: item.caption } : null;
  }));
  const photos = loaded.filter((item): item is Photo => item !== null);
  cover(doc, pkg, destination, photos[0]);

  doc.addPage();
  chapter(doc, "01", "Discover", "Your journey at a glance");
  copy(doc, pkg.overview || pkg.tagline || pkg.title, { size: 11.5, leading: 17, gap: 24 });
  fact(doc, "Group size", packageGroupSize(pkg));
  fact(doc, "Starts from", pkg.startingPoint || "Confirm with our reservations team");
  fact(doc, "Best time", pkg.bestTime || "Confirm with our reservations team");
  doc.y += 24;
  routeDiagram(doc, pkg);
  const dates = upcomingPackageDates(pkg.departureDates);
  if (dates.length) {
    doc.ensure(70);
    kicker(doc, "Published departures", MARGIN, doc.y, MUTED);
    doc.y += 18;
    dates.forEach((date) => copy(doc, formatPackageDate(date), { size: 9, gap: 5 }));
    copy(doc, "Availability is confirmed by our reservations team before booking.", { size: 8, color: MUTED });
  }
  if (photos.length && BOTTOM - doc.y >= 120) {
    photoStrip(doc, [photos[1] || photos[0], photos[2]].filter((photo): photo is Photo => Boolean(photo)), Math.min(180, BOTTOM - doc.y - 25));
  }

  if (pkg.highlights?.length) {
    section = "Journey highlights";
    doc.addPage();
    chapter(doc, "02", "Explore", "Tour highlights");
    const photo = photos[1] || photos[0];
    if (photo) {
      const columnWidth = (CONTENT_WIDTH - 26) / 2 - 22;
      let listHeight = 0;
      for (let index = 0; index < pkg.highlights.length; index += 2) {
        listHeight += Math.max(...pkg.highlights.slice(index, index + 2).map((value) => doc.wrap(value, columnWidth, 10.5).length * 15.5)) + 22;
      }
      const photoHeight = Math.min(190, BOTTOM - doc.y - listHeight - 25);
      if (photoHeight >= 90) photoStrip(doc, [photos[2] || photo], photoHeight);
    }
    highlights(doc, pkg.highlights);
  }

  if (pkg.itinerary?.length) {
    section = "Day-by-day itinerary";
    doc.addPage();
    chapter(doc, "03", `${pkg.itinerary.length} days`, "Your day-by-day itinerary");
    const heights = pkg.itinerary.map(day => blockHeight(dayLayout(doc, day)));
    const groups = pageGroups(heights, BOTTOM - doc.y, BOTTOM - 76);
    for (let group = 0; group < groups.length; group++) {
      if (group) doc.addPage();
      for (const index of groups[group]) itineraryDay(doc, pkg.itinerary[index]);
      if (photos.length && BOTTOM - doc.y >= 150) {
        photoStrip(doc, [photos[group % photos.length]], Math.min(220, BOTTOM - doc.y - 25));
      }
    }

  }

  section = "Inclusions & exclusions";
  doc.addPage();
  chapter(doc, "04", "Your package", "Inclusions & exclusions");
  balancedIncludedLists(doc, pkg.inclusions?.length ? pkg.inclusions : ["Confirmed in your final written quotation."], pkg.exclusions?.length ? pkg.exclusions : ["Anything not expressly listed as included."]);
  if (photos.length && BOTTOM - doc.y >= 174) {
    doc.y += 24;
    photoStrip(doc, [photos[0], photos[1]].filter((photo): photo is Photo => Boolean(photo)), Math.min(210, BOTTOM - doc.y - 25));
  }

  if (pkg.faqs?.length) {
    section = "Travel notes & booking terms";
    doc.addPage();
    chapter(doc, "05", "Before you travel", "Booking information");
    bookingInformation(doc, pkg.faqs);
  }

  section = "Plan your departure";
  doc.addPage();
  const backCoverIndex = doc.doc.getPageCount() - 1;
  closing(doc, destination, photos[2] || photos[1] || photos[0]);

  // Paint footers last, after the final page count is known.
  const count = doc.doc.getPageCount();
  doc.doc.getPages().forEach((page, index) => {
    if (index === 0 || index === backCoverIndex) return;
    doc.page = page;
    doc.rule(792, LINE);
    doc.textAt("BANDHAN TOURS  /  GROUP COLLECTION", { y: 807, size: 6, bold: true, charSpacing: 0.8, color: MUTED });
    doc.textAt(`${sections[index] || section}    /    ${String(index + 1).padStart(2, "0")} - ${String(count).padStart(2, "0")}`, { y: 806, width: CONTENT_WIDTH, align: "right", size: 6.5, color: MUTED });
    doc.textAt("bandhantours.com", { y: 822, size: 6, color: MUTED });
  });
  return doc.save();
}
