// Minimal Markdown parser for React Native (no HTML rendering = no injection surface).
// shortcut: covers the subset notes use (headings, lists, tasks, quotes, code, tables, links); nested lists render flat.

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold' | 'italic' | 'code'; text: string }
  | { kind: 'wiki'; title: string }
  | { kind: 'link'; text: string; url: string };

export type Block =
  | { kind: 'heading'; level: number; inline: Inline[] }
  | { kind: 'paragraph'; inline: Inline[] }
  | { kind: 'list'; ordered: boolean; items: { checked: boolean | null; inline: Inline[] }[] }
  | { kind: 'quote'; inline: Inline[] }
  | { kind: 'code'; text: string }
  | { kind: 'table'; rows: Inline[][][] }
  | { kind: 'rule' };

const INLINE = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\[\[[^[\]\n]+\]\]|\[[^\]\n]+\]\([^)\s]+\)|\*[^*\n]+\*|_[^_\n]+_)/;

export function parseInline(text: string): Inline[] {
  return text
    .split(INLINE)
    .filter(Boolean)
    .map((part): Inline => {
      if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return { kind: 'code', text: part.slice(1, -1) };
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return { kind: 'bold', text: part.slice(2, -2) };
      if (part.startsWith('[[') && part.endsWith(']]')) return { kind: 'wiki', title: part.slice(2, -2).trim() };
      const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (link) return { kind: 'link', text: link[1], url: link[2] };
      if (/^([*_]).+\1$/.test(part) && part.length > 2) return { kind: 'italic', text: part.slice(1, -1) };
      return { kind: 'text', text: part };
    });
}

const LIST = /^\s*(?:([-*+])|(\d+)[.)])\s+(?:\[([ xX])\]\s+)?(.*)$/;

export function parseMarkdown(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith('```')) {
      const body: string[] = [];
      for (i++; i < lines.length && !lines[i].startsWith('```'); i++) body.push(lines[i]);
      i++; // closing fence
      blocks.push({ kind: 'code', text: body.join('\n') });
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, inline: parseInline(heading[2]) });
      i++;
      continue;
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      blocks.push({ kind: 'rule' });
      i++;
      continue;
    }
    if (line.startsWith('>')) {
      const body: string[] = [];
      for (; i < lines.length && lines[i].startsWith('>'); i++) body.push(lines[i].replace(/^>\s?/, ''));
      blocks.push({ kind: 'quote', inline: parseInline(body.join(' ')) });
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows: Inline[][][] = [];
      for (; i < lines.length && lines[i].trim().startsWith('|'); i++) {
        if (/^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i])) continue; // header separator
        rows.push(lines[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => parseInline(c.trim())));
      }
      blocks.push({ kind: 'table', rows });
      continue;
    }
    const first = line.match(LIST);
    if (first) {
      const ordered = !!first[2];
      const items: { checked: boolean | null; inline: Inline[] }[] = [];
      for (let m: RegExpMatchArray | null; i < lines.length && (m = lines[i].match(LIST)) && !!m[2] === ordered; i++) {
        items.push({ checked: m[3] === undefined ? null : m[3].toLowerCase() === 'x', inline: parseInline(m[4]) });
      }
      blocks.push({ kind: 'list', ordered, items });
      continue;
    }
    const para: string[] = [];
    for (; i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|>|\s*\|)/.test(lines[i]) && !LIST.test(lines[i]); i++) para.push(lines[i].trim());
    blocks.push({ kind: 'paragraph', inline: parseInline(para.join(' ')) });
  }
  return blocks;
}
