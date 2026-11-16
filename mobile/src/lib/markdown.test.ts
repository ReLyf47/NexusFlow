import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseInline, parseMarkdown } from './markdown.ts';

test('inline: bold, code, wikilinks and links', () => {
  assert.deepEqual(parseInline('a **b** `c` [[Doc A]] [x](https://e.dev)'), [
    { kind: 'text', text: 'a ' },
    { kind: 'bold', text: 'b' },
    { kind: 'text', text: ' ' },
    { kind: 'code', text: 'c' },
    { kind: 'text', text: ' ' },
    { kind: 'wiki', title: 'Doc A' },
    { kind: 'text', text: ' ' },
    { kind: 'link', text: 'x', url: 'https://e.dev' },
  ]);
});

test('blocks: headings, lists, tasks, quotes, code, tables', () => {
  const blocks = parseMarkdown('## Title\n\n- one\n- [x] two\n\n1. first\n\n> quoted\n\n```\n[[not a link]]\n```\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\nplain\ncontinued');
  assert.deepEqual(blocks.map((b) => b.kind), ['heading', 'list', 'list', 'quote', 'code', 'table', 'paragraph']);
  const list = blocks[1] as Extract<(typeof blocks)[number], { kind: 'list' }>;
  assert.deepEqual(list.items.map((i) => i.checked), [null, true]);
  assert.equal((blocks[4] as { text: string }).text, '[[not a link]]');
  assert.equal((blocks[5] as { rows: unknown[] }).rows.length, 2);
  assert.deepEqual((blocks[6] as { inline: unknown }).inline, [{ kind: 'text', text: 'plain continued' }]);
});
