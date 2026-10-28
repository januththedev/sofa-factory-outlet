import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, type Db, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { ingestDocument, searchKnowledge } from '@/lib/kb/api';
import { seedKnowledge } from '@/lib/seed/knowledge';

let db: Db;

const markdown = (title: string, tags: string[], priority: 'high' | 'normal' | 'low', body: string) => [
  '---',
  `title: ${title}`,
  `tags: [${tags.join(', ')}]`,
  `priority: ${priority}`,
  '---',
  body,
].join('\n');

beforeAll(async () => {
  db = await getDb();
});

afterAll(async () => {
  await closeDb();
});

describe('knowledge ingest and retrieval', () => {
  it('creates chunks and versions, while the same checksum is a no-op', async () => {
    const first = await ingestDocument({
      slug: 'kb-test-versioning',
      kind: 'md',
      text: markdown('Versioning', ['versioning'], 'normal', '## First\nThe original aardvark answer.'),
      source: 'upload',
    });
    expect(first).toMatchObject({ ok: true, version: 1, chunks: 1 });
    if (!first.ok) return;
    const createdChunks = await db.select().from(s.kbChunks)
      .where(eq(s.kbChunks.documentId, first.documentId));
    expect(createdChunks).toHaveLength(1);
    expect(createdChunks[0]).toMatchObject({
      headingPath: 'Versioning › First',
      body: 'The original aardvark answer.',
    });
    const same = await ingestDocument({
      slug: 'kb-test-versioning',
      kind: 'md',
      text: markdown('Versioning', ['versioning'], 'normal', '## First\nThe original aardvark answer.'),
      source: 'upload',
    });
    expect(same).toEqual(first);
    const second = await ingestDocument({
      slug: 'kb-test-versioning',
      kind: 'md',
      text: markdown('Versioning', ['versioning'], 'normal', '## Second\nThe replacement capybara answer.'),
      source: 'upload',
    });
    expect(second).toMatchObject({ ok: true, version: 2, chunks: 1 });
    const documents = await db.select().from(s.kbDocuments)
      .where(eq(s.kbDocuments.slug, 'kb-test-versioning')).orderBy(s.kbDocuments.version);
    expect(documents.map((document) => [document.version, document.isCurrent])).toEqual([[1, false], [2, true]]);
    expect(await searchKnowledge('aardvark', { tags: ['versioning'] })).toEqual([]);
    expect((await searchKnowledge('capybara', { tags: ['versioning'] }))[0].documentId)
      .toBe(second.ok ? second.documentId : -1);
  });

  it('upserts FAQs by normalised question without resetting hit counts', async () => {
    const first = await ingestDocument({
      slug: 'kb-test-faq',
      kind: 'json',
      text: JSON.stringify([{ q: 'How is delivery arranged?', a: 'First answer.', tags: ['delivery'] }]),
      source: 'upload',
    });
    expect(first).toMatchObject({ ok: true, faqs: 1 });
    await db.update(s.faqs).set({ hitCount: 7 }).where(eq(s.faqs.question, 'How is delivery arranged?'));
    await ingestDocument({
      slug: 'kb-test-faq',
      kind: 'json',
      text: JSON.stringify([{ q: '  HOW IS DELIVERY ARRANGED? ', a: 'Updated answer.', tags: ['delivery'] }]),
      source: 'upload',
    });
    const matches = await db.select().from(s.faqs)
      .where(sql`lower(trim(${s.faqs.question})) = 'how is delivery arranged?'`);
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ answer: 'Updated answer.', hitCount: 7, source: 'upload' });
  });

  it('finds the right chunk and respects tags and disabled documents', async () => {
    const result = await ingestDocument({
      slug: 'kb-test-search',
      kind: 'md',
      text: markdown(
        'Fabric care',
        ['care'],
        'normal',
        '## Velvet\nCross-ventilate velvet furniture during monsoonal humidity.',
      ),
      source: 'upload',
    });
    const query = 'monsoonal cross-ventilate velvet';
    expect((await searchKnowledge(query, { tags: ['care'] }))[0]).toMatchObject({
      headingPath: 'Fabric care › Velvet',
    });
    expect(await searchKnowledge(query, { tags: ['delivery'] })).toEqual([]);
    if (!result.ok) return;
    await db.update(s.kbDocuments).set({ enabled: false }).where(eq(s.kbDocuments.id, result.documentId));
    expect(await searchKnowledge(query, { tags: ['care'] })).toEqual([]);
  });

  it('uses high priority to break full-text ranking ties', async () => {
    const body = '## Terms\nZyzzyva delivery guidance is available.';
    await ingestDocument({
      slug: 'kb-test-priority-low',
      kind: 'md',
      text: markdown('Low priority', ['priority-test'], 'low', body),
      source: 'upload',
    });
    await ingestDocument({
      slug: 'kb-test-priority-high',
      kind: 'md',
      text: markdown('High priority', ['priority-test'], 'high', body),
      source: 'upload',
    });
    const hits = await searchKnowledge('zyzzyva delivery guidance', { tags: ['priority-test'], limit: 2 });
    expect(hits.map((hit) => hit.documentTitle)).toEqual(['High priority', 'Low priority']);
  });

  it('loader tolerates an empty knowledge folder', async () => {
    const original = process.cwd();
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'kb-loader-'));
    const logs: string[] = [];
    try {
      await fs.mkdir(path.join(temporary, 'content', 'knowledge'), { recursive: true });
      process.chdir(temporary);
      await seedKnowledge(db, (message) => logs.push(message));
    } finally {
      process.chdir(original);
      await fs.rm(temporary, { recursive: true, force: true });
    }
    expect(logs).toEqual([expect.stringContaining('empty')]);
  });

  it('starter loader never overwrites a document edited in admin', async () => {
    const [document] = await db.select().from(s.kbDocuments).where(and(
      eq(s.kbDocuments.slug, 'kb-test-versioning'),
      eq(s.kbDocuments.isCurrent, true),
    ));
    await db.update(s.kbDocuments).set({ editedInAdmin: true }).where(eq(s.kbDocuments.id, document.id));
    const original = process.cwd();
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'kb-loader-edited-'));
    const logs: string[] = [];
    try {
      const folder = path.join(temporary, 'content', 'knowledge');
      await fs.mkdir(folder, { recursive: true });
      await fs.writeFile(path.join(folder, 'kb-test-versioning.md'), markdown(
        'Starter replacement',
        ['versioning'],
        'normal',
        '## Replacement\nThis starter text must not replace the admin copy.',
      ));
      process.chdir(temporary);
      await seedKnowledge(db, (message) => logs.push(message));
    } finally {
      process.chdir(original);
      await fs.rm(temporary, { recursive: true, force: true });
    }
    const versions = await db.select().from(s.kbDocuments)
      .where(eq(s.kbDocuments.slug, 'kb-test-versioning'));
    expect(versions).toHaveLength(2);
    expect(logs).toEqual([expect.stringContaining('edited in admin')]);
  });
});
