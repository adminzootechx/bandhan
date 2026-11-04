import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { clip, endPath, popGraphicsState, pushGraphicsState, rectangle, type PDFImage } from "pdf-lib";
import { PAGE_HEIGHT, PdfDoc } from "./layout";

/** Loads snapshot images from either the web or /public, with graceful fallback. */
export async function loadProposalImage(
  doc: PdfDoc,
  source?: string
): Promise<PDFImage | null> {
  if (!source) return null;
  try {
    let bytes: Uint8Array;
    let isPng = /\.png(?:$|\?)/i.test(source);
    if (/^https?:\/\//i.test(source)) {
      const response = await fetch(source, { cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (!response.ok) return null;
      bytes = new Uint8Array(await response.arrayBuffer());
      isPng = (response.headers.get("content-type") || "").includes("png") || isPng;
    } else {
      const publicPath = source.replace(/^\/+/, "");
      bytes = new Uint8Array(await fs.readFile(path.join(process.cwd(), "public", publicPath)));
    }
    // Admin uploads and the site hero library also contain WebP/AVIF. Normalize
    // those formats, and bound photo resolution for a shareable brochure.
    if (isPng) return await doc.doc.embedPng(bytes);
    const jpeg = await sharp(bytes).rotate().resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 86 }).toBuffer();
    return await doc.doc.embedJpg(jpeg);
  } catch {
    return null;
  }
}

/** Crops a photo to fill a rectangle, mirroring CSS object-fit: cover. */
export function drawImageCover(
  doc: PdfDoc,
  image: PDFImage,
  x: number,
  top: number,
  width: number,
  height: number,
  opacity = 1
) {
  const bottom = PAGE_HEIGHT - top - height;
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  doc.page.pushOperators(pushGraphicsState(), rectangle(x, bottom, width, height), clip(), endPath());
  doc.page.drawImage(image, {
    x: x + (width - drawWidth) / 2,
    y: bottom + (height - drawHeight) / 2,
    width: drawWidth,
    height: drawHeight,
    opacity,
  });
  doc.page.pushOperators(popGraphicsState());
}
