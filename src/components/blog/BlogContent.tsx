import { Fragment } from "react";
import { contentLinks } from "@/lib/blogContent";

export default function BlogContent({ content }: { content: string }) {
  const paragraphs = content.split(/\r?\n\s*\r?\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  return (
    <div className="space-y-5">
      {paragraphs.map((paragraph, index) => {
        const links = contentLinks(paragraph);
        let cursor = 0;
        return (
          <p key={index} className="whitespace-pre-line break-words text-base text-foreground leading-8">
            {links.map((link) => {
              const before = paragraph.slice(cursor, link.start);
              cursor = link.end;
              return <Fragment key={link.start}>{before}<a href={link.href} className="font-semibold text-accent underline decoration-accent/50 underline-offset-4 hover:text-primary">{link.label}</a></Fragment>;
            })}
            {paragraph.slice(cursor)}
          </p>
        );
      })}
    </div>
  );
}
