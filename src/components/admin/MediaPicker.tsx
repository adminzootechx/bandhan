"use client";

import React, { useMemo, useRef, useState } from "react";
import { IMAGE_ACCEPT, MAX_IMAGES_PER_UPLOAD, imageLinkProblem, uploadImages } from "@/lib/admin/imageLinks";
import { useCollection } from "@/lib/admin/store";
import type { GalleryItem } from "@/data/mockData";

interface MediaPickerProps {
  value: string | string[] | undefined;
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  label?: string;
  onUploadingChange?: (uploading: boolean) => void;
}

export default function MediaPicker({ value, onChange, multiple = false, label, onUploadingChange }: MediaPickerProps) {
  const { items: gallery } = useCollection<GalleryItem>("gallery");
  const inputRef = useRef<HTMLInputElement>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [brokenUrls, setBrokenUrls] = useState<string[]>([]);
  const selected = useMemo(() => (Array.isArray(value) ? value : value ? [value] : []), [value]);

  const update = (next: string[]) => onChange(multiple ? next : next[0] || "");
  const remove = (url: string) => update(selected.filter((item) => item !== url));
  const toggleLibraryItem = (url: string) => {
    if (!multiple) {
      update([url]);
      setShowLibrary(false);
      return;
    }
    update(selected.includes(url) ? selected.filter((item) => item !== url) : [...selected, url]);
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length || uploading) return;
    setError("");
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const urls = await uploadImages(files, multiple ? MAX_IMAGES_PER_UPLOAD : 1);
      if (!urls.length) setError("Choose a JPG, PNG, WEBP or GIF photo.");
      else update(multiple ? [...selected, ...urls] : urls);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  // Older records may still hold pasted links; flag the ones that can't work so they get replaced.
  const selectedProblem = selected.map(imageLinkProblem).find(Boolean)
    || (selected.some((url) => brokenUrls.includes(url)) ? "An image above didn't load — it may be a web page or a deleted file. Remove it and upload the photo instead." : "");

  return (
    <div className="space-y-3">
      {label && <p className="text-xs font-semibold text-primary uppercase tracking-wide">{label}</p>}
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-primary">Selected media <span className="text-accent">{selected.length}</span></p>
        {multiple && selected.length > 0 && <p className="text-[11px] text-foreground-light">First image is the cover</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        {selected.map((url, index) => (
          <div key={`${url}-${index}`} className="relative w-28 h-24 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Selected media ${index + 1}`} onError={() => setBrokenUrls((current) => (current.includes(url) ? current : [...current, url]))} className="w-full h-full object-cover" />
            {brokenUrls.includes(url) && <span className="absolute inset-0 flex items-center justify-center bg-accent/85 p-1 text-center text-[10px] font-bold text-white">Not an image</span>}
            {multiple && index === 0 && <span className="absolute left-1 bottom-1 px-1.5 py-0.5 rounded bg-primary/85 text-white text-[9px] font-bold uppercase">Cover</span>}
            <button type="button" onClick={() => remove(url)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-primary/80 text-white text-xs transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100" aria-label="Remove image">×</button>
          </div>
        ))}
        {selected.length === 0 && <div className="w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-foreground-muted">No media selected yet.</div>}
      </div>

      <div className={`rounded-2xl border-2 border-dashed p-4 transition-colors ${dragActive ? "border-accent bg-accent/5" : "border-slate-200 bg-slate-50/70"}`} onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }} onDragOver={(event) => event.preventDefault()} onDragLeave={() => setDragActive(false)} onDrop={(event) => { event.preventDefault(); setDragActive(false); void upload(event.dataTransfer.files); }}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div><p className="text-sm font-semibold text-primary">Add travel photos</p><p className="text-[11px] text-foreground-muted mt-0.5">Drag images here, choose from your gallery, or upload from your device.</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowLibrary((open) => !open)} className="px-3.5 py-2 rounded-full border border-primary/15 text-xs font-bold text-primary hover:border-primary hover:bg-primary hover:text-white transition-colors">{showLibrary ? "Hide gallery" : "Choose from gallery"}</button>
            <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className="px-3.5 py-2 rounded-full bg-accent text-white text-xs font-bold hover:bg-accent-dark disabled:opacity-60 transition-colors">{uploading ? "Uploading..." : multiple ? "Upload images" : selected.length ? "Replace image" : "Upload image"}</button>
            <input ref={inputRef} type="file" accept={IMAGE_ACCEPT} multiple={multiple} onChange={(event) => void upload(event.target.files)} className="hidden" />
          </div>
        </div>
      </div>

      {showLibrary && <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 rounded-2xl border border-slate-100 bg-sand/60 p-3 max-h-56 overflow-y-auto">{gallery.map((item) => { const active = selected.includes(item.image); return <button key={item.id} type="button" onClick={() => toggleLibraryItem(item.image)} className={`relative aspect-square rounded-xl overflow-hidden border-2 ${active ? "border-accent" : "border-transparent"}`} title={item.title}>
        {/* Older gallery items may be links on hosts not known at build time. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.image} alt={item.title} className="w-full h-full object-cover" />
        {active && <span className="absolute inset-0 bg-accent/35 flex items-center justify-center text-white text-xl">✓</span>}
      </button>; })}{gallery.length === 0 && <p className="col-span-full py-4 text-xs text-foreground-muted">Add images in Gallery first, or upload new media.</p>}</div>}

      <p className="text-[11px] text-foreground-light">JPG, PNG or WEBP (large photos are resized automatically), or GIF up to 8MB.{multiple ? ` Up to ${MAX_IMAGES_PER_UPLOAD} at a time.` : ""} Click Create/Save after uploading to attach the media.</p>
      {selectedProblem && <div className="rounded-xl border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-accent-dark">{selectedProblem}</div>}
      {error && <div className="rounded-xl border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-accent-dark">{error}</div>}
    </div>
  );
}
