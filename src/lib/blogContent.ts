export interface ContentLink {
  start: number;
  end: number;
  label: string;
  href: string;
}

/** Only web URLs and paths within this site can become clickable article links. */
export function normalizeContentUrl(input: string): string | null {
  const value = input.trim();
  if (!value || /[\s\\\u0000-\u001f\u007f]/.test(value)) return null;
  const local = value.startsWith("/") && !value.startsWith("//");
  if (!local && !/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value, "https://bandhantours.com");
    if (!local && (!url.hostname || url.username || url.password)) return null;
    // Keep Markdown delimiters out of the destination, including parentheses in URLs.
    return (local ? value : url.href).replace(/[()[\]]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
  } catch {
    return null;
  }
}

export function contentLinkMarkup(label: string, href: string): string {
  const safeUrl = normalizeContentUrl(href);
  if (!safeUrl) throw new Error("Enter an https:// or http:// URL, or a site path such as /packages.");
  if (!label.trim() || /[\r\n]/.test(label)) throw new Error("Enter the keywords to link on one line.");
  return `[${label.replace(/[\\[\]]/g, "\\$&")}](${safeUrl})`;
}

/** Parse only inline links; HTML is always left as ordinary, escaped React text. */
export function contentLinks(content: string): ContentLink[] {
  const links: ContentLink[] = [];
  const pattern = /\[((?:\\[\\\[\]]|[^\[\]\\\r\n])+)\]\(/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(content))) {
    let cursor = pattern.lastIndex;
    const destinationStart = cursor;
    let depth = 1;
    while (cursor < content.length && depth > 0 && !/\s/.test(content[cursor])) {
      if (content[cursor] === "(") depth += 1;
      if (content[cursor] === ")") depth -= 1;
      cursor += 1;
    }
    if (depth !== 0) continue;
    const href = normalizeContentUrl(content.slice(destinationStart, cursor - 1));
    if (!href) continue;
    links.push({ start: match.index, end: cursor, label: match[1].replace(/\\([\\\[\]])/g, "$1"), href });
    pattern.lastIndex = cursor;
  }
  return links;
}
