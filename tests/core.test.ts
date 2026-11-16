import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractWikilinks, linkifyWikilinks, normalizeTag } from '../src/lib/markdown';
import { jaccard, rankRelated } from '../src/lib/context';
import { matchMember, normalizeActionItem, normalizePriority } from '../src/lib/ai';
import { effectiveRole, isValidIsoDate } from '../src/lib/domain';

test('wikilinks: extracted once, case-insensitively, never from code', () => {
  const md = 'See [[Alpha]] and [[alpha]] plus [[ Beta ]].\n`[[Inline]]`\n```\n[[Fenced]]\n```';
  assert.deepEqual(extractWikilinks(md), ['alpha', 'Beta']);
  assert.match(linkifyWikilinks('x [[A B]] `[[C]]`'), /\[A B\]\(#wiki:A%20B\) `\[\[C\]\]`/);
});

test('tags are normalized to lowercase slugs', () => {
  assert.equal(normalizeTag('  #Meeting Notes! '), 'meeting-notes');
  assert.equal(normalizeTag('###'), '');
});

test('relevance score follows SDD 6.1 weights', () => {
  assert.equal(jaccard(new Set(['a', 'b']), new Set(['b', 'c'])), 1 / 3);
  const active = { id: '1', title: 'A', projectName: 'P' };
  const docs = [active, { id: '2', title: 'B', projectName: 'P' }, { id: '3', title: 'C', projectName: 'General' }, { id: '4', title: 'D', projectName: 'Q' }];
  const tags = new Map([['1', new Set(['x', 'y'])], ['2', new Set(['x', 'y'])], ['3', new Set(['x'])]]);
  const ranked = rankRelated(active, docs, tags, new Set(['2']));
  assert.deepEqual(ranked.map((r) => [r.id, r.score]), [['2', 1], ['3', 0.18]]); // doc 4 shares nothing → dropped
  // 'General' is a default bucket, never a project match
  assert.equal(rankRelated({ ...active, projectName: 'General' }, docs, new Map(), new Set()).length, 0);
});

test('AI drafts are normalized and validated', () => {
  const members = [{ id: 'u1', name: 'Sarah Wijaya' }, { id: 'u2', name: 'Dimas Pratama' }];
  assert.equal(matchMember('sarah', members), 'u1');
  assert.equal(matchMember('PRATAMA', members), 'u2');
  assert.equal(matchMember('Al', members), null);
  assert.equal(normalizePriority('Tinggi'), 'high');
  assert.equal(normalizePriority('???'), 'medium');
  assert.deepEqual(normalizeActionItem({ title: ' Deploy ', assignee: 'Dimas', dueDate: '2026-02-30', priority: 'urgent' }, members), {
    title: 'Deploy', description: null, assigneeHint: 'Dimas', assigneeId: 'u2', dueDate: null, priority: 'urgent',
  });
  assert.equal(normalizeActionItem({ title: 'x' }, members), null);
});

test('role preview can only lower privileges', () => {
  assert.equal(effectiveRole('Admin', 'Viewer'), 'Viewer');
  assert.equal(effectiveRole('Viewer', 'Admin'), 'Viewer');
  assert.equal(effectiveRole('Editor', null), 'Editor');
  assert.ok(isValidIsoDate('2028-02-29') && !isValidIsoDate('2026-02-29') && !isValidIsoDate('26-1-1'));
});
