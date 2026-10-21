import { isImagePageLink } from "@/lib/imageHosts";
import { uploadFiles } from "@/lib/uploadthing";
import { ensureAdminSession } from "./session";

/** Flags an unusable image link saved before uploads replaced pasting; "" when it looks fine. */
export function imageLinkProblem(url: string): string {
  const value = url.trim();
  if (!value) return "";
  if (value.startsWith("/") && !value.startsWith("//") && !/\s/.test(value)) return "";
  if (!/^https:\/\/\S+$/i.test(value)) return "This image link isn't valid. Upload the photo instead.";
  if (isImagePageLink(value)) return "This is a link to a web page, not the image itself. Upload the photo instead.";
  return "";
}

export const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif";
export const MAX_IMAGES_PER_UPLOAD = 30;
/** Matches `imageUploader`'s maxFileCount in the UploadThing file router. */
const UPLOAD_BATCH = 10;
/** Covers a 2x full-bleed hero; the site re-encodes for visitors, so more is wasted storage. */
const MAX_EDGE = 2560;
const SHRINK_ABOVE_BYTES = 500 * 1024;

/** Resizes large photos to MAX_EDGE as WebP. Falls back to the original whenever that wouldn't help. */
async function shrinkImage(file: File): Promise<File> {
  if (typeof document === "undefined" || file.size <= SHRINK_ABOVE_BYTES || file.type === "image/gif") return file;
  const source = URL.createObjectURL(file);
  try {
    // An <img> applies the photo's EXIF rotation; createImageBitmap doesn't everywhere.
    const img = new Image();
    img.src = source;
    await img.decode();
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    // Browsers that can't encode WebP hand back a PNG, which is usually bigger.
    if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(source);
  }
}

/** Shrinks and uploads images to UploadThing (admin session required), returning their public URLs. */
export async function uploadImages(files: FileList | File[] | null, limit = MAX_IMAGES_PER_UPLOAD): Promise<string[]> {
  const list = Array.from(files || []).filter((file) => file.type.startsWith("image/")).slice(0, limit);
  if (!list.length) return [];
  await ensureAdminSession();
  const urls: string[] = [];
  for (let start = 0; start < list.length; start += UPLOAD_BATCH) {
    // One at a time: decoding a batch of full-size phone photos at once can exhaust memory.
    const batch: File[] = [];
    for (const file of list.slice(start, start + UPLOAD_BATCH)) batch.push(await shrinkImage(file));
    const result = await uploadFiles("imageUploader", { files: batch });
    urls.push(...result.map((file) => file.ufsUrl));
  }
  return urls;
}
