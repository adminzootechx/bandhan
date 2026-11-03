"use client";

import { useId, useRef, useState } from "react";
import { Link as LinkIcon } from "lucide-react";
import BlogContent from "@/components/blog/BlogContent";
import { contentLinkMarkup, contentLinks } from "@/lib/blogContent";

const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm font-medium text-primary focus:border-accent focus:outline-none";

interface LinkDraft {
  start: number;
  end: number;
  keywords: string;
  url: string;
  existing: boolean;
}

export default function BlogContentEditor({ value, onChange, required }: {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const id = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [linkDraft, setLinkDraft] = useState<LinkDraft | null>(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(false);

  const openLink = () => {
    const start = textarea.current?.selectionStart ?? value.length;
    const end = textarea.current?.selectionEnd ?? start;
    const existing = contentLinks(value).find((link) => start >= link.start && end <= link.end && start < link.end);
    setLinkDraft(existing
      ? { start: existing.start, end: existing.end, keywords: existing.label, url: existing.href, existing: true }
      : { start, end, keywords: value.slice(start, end), url: "", existing: false });
    setError("");
  };

  const replaceSelection = (replacement: string) => {
    if (!linkDraft) return;
    const next = value.slice(0, linkDraft.start) + replacement + value.slice(linkDraft.end);
    const cursor = linkDraft.start + replacement.length;
    onChange(next);
    setLinkDraft(null);
    setError("");
    requestAnimationFrame(() => {
      textarea.current?.focus();
      textarea.current?.setSelectionRange(cursor, cursor);
    });
  };

  const applyLink = () => {
    if (!linkDraft) return;
    try {
      replaceSelection(contentLinkMarkup(linkDraft.keywords, linkDraft.url));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Check the link and try again.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={openLink} disabled={preview || Boolean(linkDraft)} className="inline-flex items-center gap-2 rounded-full border border-primary/20 px-3.5 py-2 text-xs font-bold text-primary hover:bg-sand disabled:opacity-50">
          <LinkIcon size={15} aria-hidden="true" /> Add / edit link
        </button>
        <button type="button" aria-pressed={preview} disabled={Boolean(linkDraft)} onClick={() => setPreview((current) => !current)} className="rounded-full px-3.5 py-2 text-xs font-bold text-primary hover:bg-sand disabled:opacity-50">
          {preview ? "Edit content" : "Preview content"}
        </button>
      </div>
      <textarea
        ref={textarea}
        aria-label="Blog content"
        aria-describedby={`${id}-help`}
        rows={10}
        required={required}
        value={value}
        readOnly={Boolean(linkDraft)}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
            event.preventDefault();
            if (!linkDraft) openLink();
          }
        }}
        className={`${inputClass} ${preview ? "hidden" : ""}`}
      />
      {linkDraft && (
        <div role="group" aria-label={linkDraft.existing ? "Edit keyword link" : "Add keyword link"} className="space-y-3 rounded-2xl border border-slate-200 bg-sand/50 p-4" onKeyDown={(event) => {
          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setLinkDraft(null); textarea.current?.focus(); }
          if (event.key === "Enter" && event.target instanceof HTMLInputElement) { event.preventDefault(); applyLink(); }
        }}>
          <label className="block space-y-1 text-xs font-semibold text-primary">
            <span>Keywords / link text</span>
            <input autoFocus value={linkDraft.keywords} onChange={(event) => setLinkDraft({ ...linkDraft, keywords: event.target.value })} className={inputClass} placeholder="e.g. Japan tour packages" />
          </label>
          <label className="block space-y-1 text-xs font-semibold text-primary">
            <span>Link URL</span>
            <input value={linkDraft.url} onChange={(event) => setLinkDraft({ ...linkDraft, url: event.target.value })} className={inputClass} placeholder="https://example.com or /packages" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} />
          </label>
          {error && <p id={`${id}-error`} role="alert" className="text-xs text-accent-dark">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={applyLink} className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-white">{linkDraft.existing ? "Update link" : "Insert link"}</button>
            {linkDraft.existing && <button type="button" onClick={() => replaceSelection(linkDraft.keywords)} className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-accent">Remove link</button>}
            <button type="button" onClick={() => { setLinkDraft(null); textarea.current?.focus(); }} className="rounded-full px-4 py-2 text-xs font-bold text-primary">Cancel link</button>
          </div>
        </div>
      )}
      {preview && <div aria-label="Content preview" className="rounded-2xl border border-slate-200 bg-white p-4">{value.trim() ? <BlogContent content={value} /> : <p className="text-sm text-foreground-muted">Your content preview will appear here.</p>}</div>}
      <p id={`${id}-help`} className="text-xs leading-relaxed text-foreground-muted">Select keywords, then choose Add / edit link. Click inside an existing link to update or remove it. Separate paragraphs with a blank line.</p>
    </div>
  );
}
