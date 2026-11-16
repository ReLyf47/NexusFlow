// Wikilink helpers shared by the link extractor (server) and the renderer (client).
const CODE = /(```[\s\S]*?```|`[^`\n]*`)/;
const WIKI = /\[\[([^[\]\n|]{1,100})\]\]/g;

// Applies fn only to text outside fenced/inline code (split keeps code at odd indices)
const mapOutsideCode = (md: string, fn: (text: string) => string) =>
  md
    .split(CODE)
    .map((part, i) => (i % 2 ? part : fn(part)))
    .join('');

export function extractWikilinks(md: string): string[] {
  const titles = new Map<string, string>();
  mapOutsideCode(md, (text) => {
    for (const m of text.matchAll(WIKI)) {
      const title = m[1].trim();
      if (title) titles.set(title.toLowerCase(), title);
    }
    return text;
  });
  return [...titles.values()];
}

export const WIKI_HREF_PREFIX = '#wiki:';

// [[Title]] -> [Title](#wiki:Title) so react-markdown renders it through our link component
export const linkifyWikilinks = (md: string) =>
  mapOutsideCode(md, (text) =>
    text.replace(WIKI, (_, title: string) => `[${title.trim()}](${WIKI_HREF_PREFIX}${encodeURIComponent(title.trim())})`)
  );

export const normalizeTag = (raw: string) =>
  raw
    .trim()
    .replace(/^#+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
