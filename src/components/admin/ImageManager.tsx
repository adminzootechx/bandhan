"use client";

import React, { useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ChevronDown, ImagePlus, Search, Trash2, TriangleAlert, Upload } from "lucide-react";
import PageHeader from "@/components/admin/PageHeader";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { store, useCollection } from "@/lib/admin/store";
import { IMAGE_ACCEPT, MAX_IMAGES_PER_UPLOAD, imageLinkProblem, uploadImages } from "@/lib/admin/imageLinks";
import type { Destination, PackageGalleryImage, TourPackage } from "@/data/mockData";

type Tab = "packages" | "destinations";

interface GalleryDraft {
  image: string;
  caption: string;
}

interface ImageDraft {
  image: string;
  heroImage: string;
  gallery: GalleryDraft[];
}

interface ManagedItem {
  id: string;
  title: string;
  subtitle: string;
  isDraft: boolean;
  images: ImageDraft;
}

const fieldClass =
  "w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-primary transition-colors focus:border-accent focus:outline-none";

function fromPackage(pkg: TourPackage): ManagedItem {
  return {
    id: pkg.id,
    title: pkg.title,
    subtitle: [pkg.category, pkg.duration].filter(Boolean).join(" · "),
    isDraft: pkg.status === "draft",
    images: {
      image: pkg.image || "",
      heroImage: pkg.heroImage || "",
      gallery: (pkg.gallery || [])
        .filter((slide) => !slide.placeholder)
        .map((slide) => ({ image: slide.image, caption: slide.caption || "" })),
    },
  };
}

function fromDestination(destination: Destination): ManagedItem {
  return {
    id: destination.id,
    title: destination.name,
    subtitle: [destination.country, destination.region].filter(Boolean).join(" · "),
    isDraft: destination.status === "draft",
    images: {
      image: destination.image || "",
      heroImage: "",
      gallery: (destination.gallery || []).map((image) => ({ image, caption: "" })),
    },
  };
}

function ImagePreview({ url, className = "" }: { url: string; className?: string }) {
  const [failedUrl, setFailedUrl] = useState("");
  const failed = Boolean(url) && failedUrl === url;

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${className}`}>
      {url && !failed ? (
        // Older images may be pasted links on any host, so this preview bypasses next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" onError={() => setFailedUrl(url)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center p-2 text-center text-[11px] font-semibold text-foreground-light">
          {failed ? "Image didn't load" : "No image"}
        </div>
      )}
    </div>
  );
}

/** Uploads photos picked from this device, or dropped onto `dropHandlers`, to UploadThing. */
function useImageUpload(multiple: boolean, onUploaded: (urls: string[]) => void) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const limit = multiple ? MAX_IMAGES_PER_UPLOAD : 1;
    setUploading(Math.min(files.length, limit));
    setError("");
    try {
      const urls = await uploadImages(files, limit);
      if (urls.length) onUploaded(urls);
      else setError("Choose a JPG, PNG, WEBP or GIF photo.");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed. Try again.");
    } finally {
      setUploading(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const dropHandlers = {
    onDragEnter: (event: React.DragEvent) => { event.preventDefault(); setDragActive(true); },
    onDragOver: (event: React.DragEvent) => event.preventDefault(),
    onDragLeave: () => setDragActive(false),
    onDrop: (event: React.DragEvent) => { event.preventDefault(); setDragActive(false); if (!uploading) void upload(event.dataTransfer.files); },
  };

  const fileInput = (
    <input ref={inputRef} type="file" accept={IMAGE_ACCEPT} multiple={multiple} onChange={(event) => void upload(event.target.files)} className="hidden" />
  );

  return { uploading, dragActive, error, dropHandlers, fileInput, pick: () => inputRef.current?.click() };
}

function ImageSlot({
  label,
  hint,
  value,
  onChange,
  optional = false,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  const { uploading, dragActive, error, dropHandlers, fileInput, pick } = useImageUpload(false, (urls) => onChange(urls[0]));
  const problem = imageLinkProblem(value);

  return (
    <div className="grid gap-3 sm:grid-cols-[200px_1fr]">
      <button
        type="button"
        onClick={pick}
        disabled={Boolean(uploading)}
        aria-label={`${value ? "Replace" : "Upload"} ${label.toLowerCase()}`}
        {...dropHandlers}
        className={`relative aspect-[4/3] w-full overflow-hidden rounded-xl transition-shadow ${dragActive ? "ring-2 ring-accent ring-offset-2" : ""}`}
      >
        {value ? (
          <ImagePreview url={problem ? "" : value.trim()} className="h-full w-full" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-xs font-semibold text-foreground-muted hover:border-accent hover:text-accent">
            <ImagePlus size={22} aria-hidden="true" />
            Click or drop a photo
          </span>
        )}
        {uploading > 0 && (
          <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-primary/70 text-xs font-bold text-white">Uploading…</span>
        )}
      </button>
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">{label}</p>
        <p className="text-[11px] text-foreground-light">{hint}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button type="button" onClick={pick} disabled={Boolean(uploading)} className="flex min-h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-xs font-bold text-white transition-colors hover:bg-accent-dark disabled:opacity-60">
            <Upload size={15} /> {uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
          </button>
          {optional && value && (
            <button type="button" onClick={() => onChange("")} disabled={Boolean(uploading)} className="flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 px-4 text-xs font-bold text-primary hover:bg-slate-50 disabled:opacity-40">
              <Trash2 size={15} /> Remove
            </button>
          )}
        </div>
        {fileInput}
        {problem && (
          <p className="flex items-start gap-1.5 text-xs font-medium text-accent-dark">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {problem}
          </p>
        )}
        {error && <p className="text-xs font-medium text-accent-dark">{error}</p>}
      </div>
    </div>
  );
}

function GalleryUploadTile({ onUploaded }: { onUploaded: (urls: string[]) => void }) {
  const { uploading, dragActive, error, dropHandlers, fileInput, pick } = useImageUpload(true, onUploaded);

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={pick}
        disabled={Boolean(uploading)}
        {...dropHandlers}
        className={`flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed p-3 text-center transition-colors disabled:cursor-wait ${dragActive ? "border-accent bg-accent/5 text-accent" : "border-slate-300 bg-slate-50 text-foreground-muted hover:border-accent hover:text-accent"}`}
      >
        <Upload size={22} aria-hidden="true" />
        <span className="text-xs font-bold">{uploading ? `Uploading ${uploading} photo${uploading === 1 ? "" : "s"}…` : "Add photos"}</span>
        {!uploading && <span className="text-[10px]">Click or drop up to {MAX_IMAGES_PER_UPLOAD} at once</span>}
      </button>
      {fileInput}
      {error && <p className="text-xs font-medium text-accent-dark">{error}</p>}
    </div>
  );
}

function ItemEditor({ item, tab }: { item: ManagedItem; tab: Tab }) {
  const [draft, setDraft] = useState<ImageDraft>(item.images);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(item.images);
  const allUrls = [draft.image, draft.heroImage, ...draft.gallery.map((slide) => slide.image)];
  const hasProblem = allUrls.some((url) => imageLinkProblem(url));

  const setField = (field: "image" | "heroImage", value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setMessage(null);
  };

  const updateGallery = (next: GalleryDraft[]) => {
    setDraft((current) => ({ ...current, gallery: next }));
    setMessage(null);
  };

  const moveSlide = (index: number, offset: -1 | 1) => {
    const next = [...draft.gallery];
    const [slide] = next.splice(index, 1);
    next.splice(index + offset, 0, slide);
    updateGallery(next);
  };

  // Functional update: an upload can finish after other gallery edits were made.
  const appendGallery = (urls: string[]) => {
    setDraft((current) => ({ ...current, gallery: [...current.gallery, ...urls.map((image) => ({ image, caption: "" }))] }));
    setMessage(null);
  };

  const save = async () => {
    if (hasProblem) {
      setMessage({ kind: "error", text: "Replace or remove the highlighted images before saving." });
      return;
    }
    if (!draft.image.trim()) {
      setMessage({ kind: "error", text: "A cover image is required." });
      return;
    }
    setSaving(true);
    setMessage(null);
    const gallery = draft.gallery.filter((slide) => slide.image.trim());
    try {
      if (tab === "packages") {
        await store.update<TourPackage>("packages", item.id, {
          image: draft.image.trim(),
          heroImage: draft.heroImage.trim(),
          gallery: gallery.map<PackageGalleryImage>((slide) => ({
            image: slide.image.trim(),
            caption: slide.caption.trim() || item.title,
          })),
        });
      } else {
        await store.update<Destination>("destinations", item.id, {
          image: draft.image.trim(),
          gallery: gallery.map((slide) => slide.image.trim()),
        });
      }
      setMessage({ kind: "ok", text: "Saved — the website now shows these images." });
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Could not save. Try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 border-t border-slate-100 px-4 py-5 sm:px-5">
      <ImageSlot
        label="Cover image"
        hint="Shown on cards and listings across the site."
        value={draft.image}
        onChange={(value) => setField("image", value)}
      />

      {tab === "packages" && (
        <ImageSlot
          label="Banner image (top of the itinerary page)"
          hint="Leave empty to use the cover image."
          value={draft.heroImage}
          onChange={(value) => setField("heroImage", value)}
          optional
        />
      )}

      <div className="space-y-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">
            Gallery <span className="text-accent">{draft.gallery.length}</span>
          </p>
          <p className="text-[11px] text-foreground-light">
            {tab === "packages"
              ? "Shown in the itinerary's photo grid and beside the day-by-day plan. "
              : "Shown in the destination's photo grid. "}
            With fewer than 6 photos, the site fills the gaps with stock travel photos.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {draft.gallery.map((slide, index) => {
            const problem = imageLinkProblem(slide.image);
            return (
              <div key={index} className="space-y-2 rounded-2xl border border-slate-100 bg-sand/40 p-2">
                <div className="relative">
                  <ImagePreview url={problem ? "" : slide.image.trim()} className="aspect-[4/3] w-full" />
                  {problem && (
                    <span title={problem} className="absolute inset-x-1 bottom-1 rounded-lg bg-accent/90 px-2 py-1 text-center text-[10px] font-bold text-white">
                      Broken link — replace it
                    </span>
                  )}
                </div>
                {tab === "packages" && (
                  <input
                    type="text"
                    value={slide.caption}
                    aria-label={`Gallery image ${index + 1} caption`}
                    placeholder="Caption (optional)"
                    onChange={(event) =>
                      updateGallery(draft.gallery.map((s, i) => (i === index ? { ...s, caption: event.target.value } : s)))
                    }
                    className={`${fieldClass} py-2 text-xs`}
                  />
                )}
                <div className="flex justify-between gap-1">
                  <div className="flex gap-1">
                    <button type="button" onClick={() => moveSlide(index, -1)} disabled={index === 0} aria-label={`Move image ${index + 1} earlier`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-primary disabled:opacity-30">
                      <ArrowLeft size={15} />
                    </button>
                    <button type="button" onClick={() => moveSlide(index, 1)} disabled={index === draft.gallery.length - 1} aria-label={`Move image ${index + 1} later`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-primary disabled:opacity-30">
                      <ArrowRight size={15} />
                    </button>
                  </div>
                  <button type="button" onClick={() => updateGallery(draft.gallery.filter((_, i) => i !== index))} aria-label={`Remove image ${index + 1}`} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-accent-dark hover:bg-accent/10">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
          <GalleryUploadTile onUploaded={appendGallery} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        <PrimaryButton type="button" variant="navy" size="sm" onClick={save} isLoading={saving} disabled={!dirty || saving}>
          Save images
        </PrimaryButton>
        {dirty && !saving && (
          <button type="button" onClick={() => { setDraft(item.images); setMessage(null); }} className="text-xs font-bold text-foreground-muted hover:text-primary">
            Discard changes
          </button>
        )}
        {message && (
          <p role="status" className={`text-sm font-medium ${message.kind === "ok" ? "text-emerald-600" : "text-accent-dark"}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

export default function ImageManager() {
  const { items: packages, ready: packagesReady } = useCollection<TourPackage>("packages");
  const { items: destinations, ready: destinationsReady } = useCollection<Destination>("destinations");
  const [tab, setTab] = useState<Tab>("packages");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const items = useMemo(() => {
    const all = tab === "packages" ? packages.map(fromPackage) : destinations.map(fromDestination);
    const q = query.trim().toLowerCase();
    return q ? all.filter((item) => `${item.title} ${item.subtitle} ${item.id}`.toLowerCase().includes(q)) : all;
  }, [tab, packages, destinations, query]);

  const ready = tab === "packages" ? packagesReady : destinationsReady;

  return (
    <div>
      <PageHeader
        title="Image Manager"
        description="Upload the cover, banner and gallery photos for any itinerary or destination."
      />

      <div className="mb-5 rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-primary">
        <p className="font-semibold">Uploading photos</p>
        <p className="mt-0.5 text-foreground-muted">
          Open an itinerary below, then click an image to replace it or drag photos straight from your computer onto it.
          Large photos are resized automatically before upload to save storage. Remember to click <strong>Save images</strong>.
        </p>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2" role="tablist">
          {(["packages", "destinations"] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => { setTab(key); setOpenId(null); }}
              className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${tab === key ? "bg-primary text-white" : "border border-slate-200 text-primary hover:bg-slate-50"}`}
            >
              {key === "packages" ? `Itineraries (${packages.length})` : `Destinations (${destinations.length})`}
            </button>
          ))}
        </div>
        <label className="relative sm:w-72">
          <span className="sr-only">Search</span>
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-light" aria-hidden="true" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name" className={`${fieldClass} pl-9`} />
        </label>
      </div>

      {!ready && <p className="py-6 text-sm text-foreground-muted">Loading…</p>}

      <div className="space-y-3">
        {items.map((item) => {
          const open = openId === item.id;
          return (
            <div key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : item.id)}
                aria-expanded={open}
                className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-slate-50 sm:px-5"
              >
                <ImagePreview url={item.images.image} className="h-14 w-20 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-primary">
                    {item.title}
                    {item.isDraft && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">Draft</span>}
                  </p>
                  <p className="truncate text-xs text-foreground-muted">
                    {item.subtitle || item.id} · {1 + (item.images.heroImage ? 1 : 0) + item.images.gallery.length} images
                  </p>
                </div>
                <ChevronDown size={18} className={`shrink-0 text-foreground-light transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && <ItemEditor key={item.id} item={item} tab={tab} />}
            </div>
          );
        })}
        {ready && items.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-foreground-muted">
            Nothing matches “{query}”.
          </p>
        )}
      </div>
    </div>
  );
}
