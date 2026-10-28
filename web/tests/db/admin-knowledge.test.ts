import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeDb, type Db, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { chatModels } from '@/lib/env';
import { searchKnowledge } from '@/lib/kb/api';
import { storage } from '@/lib/storage';

// The golden set needs the whole chat pipeline; the admin only stores and compares what it returns.
const golden = vi.hoisted(() => ({
  result: { total: 10, hitAt3: 0.8, intentAccuracy: 0.9, answeredWithoutModel: 0.5, failures: [] as unknown[] },
}));

vi.mock('@/lib/chat/eval', () => ({
  runGoldenSet: async () => ({ ...golden.result }),
}));

import { saveChatSettings } from '@/lib/admin/chat';
import {
  answerGap,
  compareEval,
  deleteFaq,
  dismissGap,
  exportSynonyms,
  importSynonyms,
  listVersions,
  parseSynonymImport,
  previewKnowledge,
  readLastEval,
  rollbackToVersion,
  runAndStoreEval,
  saveFaq,
  saveSynonym,
  saveUpload,
  setDocumentEnabled,
  toEvalView,
  validateUpload,
} from '@/lib/admin/knowledge';

let db: Db;
let counter = 0;
const unique = (prefix: string) => `${prefix}-${Date.now()}-${(counter += 1)}`;

beforeAll(async () => {
  db = await getDb();
});

afterAll(async () => {
  await closeDb();
});

const DEFAULT_FRONT_MATTER = ['tags: [test]', 'priority: normal'];

/** A Markdown file: front matter, an optional intro line and one `##` section per [heading, text] pair. */
function markdownFile(
  title: string,
  sections: Array<[string, string]>,
  options: { frontMatter?: string[]; intro?: string } = {},
): string {
  const front = ['---', `title: ${title}`, ...(options.frontMatter ?? DEFAULT_FRONT_MATTER), '---'].join('\n');
  const body = sections.map(([heading, text]) => `## ${heading}\n${text}`).join('\n\n');
  return [front, options.intro ?? null, body].filter((part) => part !== null).join('\n\n');
}

/** Uploads a file the way the admin does (real ingest), returning the slug it was stored under. */
async function upload(slug: string, extension: 'md' | 'json', text: string) {
  const result = await saveUpload({ fileName: `${slug}.${extension}`, text });
  expect(result.ok).toBe(true);
  return result;
}

/** What a customer's question finds: the bodies of the knowledge chunks the real search returns. */
async function found(word: string): Promise<string[]> {
  return (await searchKnowledge(word, { limit: 10 })).map((hit) => hit.body);
}

/** A version row written directly, for states the ingest never produces (no stored file, no chunks). */
async function seedVersion(
  slug: string,
  version: number,
  options: { current?: boolean; enabled?: boolean; chunks?: string[]; fileText?: string } = {},
) {
  let fileKey: string | null = null;
  if (options.fileText !== undefined) {
    fileKey = `kb-test/${slug}/v${version}.md`;
    await storage().put(fileKey, Buffer.from(options.fileText, 'utf8'), { contentType: 'text/markdown' });
  }
  const [row] = await db
    .insert(s.kbDocuments)
    .values({
      slug,
      title: slug,
      kind: 'md',
      fileKey,
      version,
      isCurrent: options.current ?? false,
      enabled: options.enabled ?? true,
    })
    .returning();
  const bodies = options.chunks ?? [];
  if (bodies.length > 0) {
    await db.insert(s.kbChunks).values(
      bodies.map((body, sortOrder) => ({
        documentId: row.id,
        headingPath: `${slug} › part ${sortOrder + 1}`,
        body,
        sortOrder,
      })),
    );
  }
  return row;
}

async function visibleBodies(slug: string): Promise<string[]> {
  const rows = await db
    .select({ body: s.kbChunks.body })
    .from(s.kbChunks)
    .innerJoin(s.kbDocuments, eq(s.kbDocuments.id, s.kbChunks.documentId))
    .where(and(eq(s.kbDocuments.slug, slug), eq(s.kbDocuments.isCurrent, true), eq(s.kbDocuments.enabled, true)))
    .orderBy(s.kbChunks.sortOrder);
  return rows.map((row) => row.body);
}

async function documentRow(id: number) {
  const [row] = await db.select().from(s.kbDocuments).where(eq(s.kbDocuments.id, id));
  return row;
}

async function versionId(slug: string, version: number): Promise<number> {
  const row = (await listVersions(slug)).find((item) => item.version === version);
  if (!row) throw new Error(`No version ${version} of ${slug}`);
  return row.id;
}

describe('rolling back a document', () => {
  it('makes an older version current again, and the search finds its words', async () => {
    const slug = unique('care');
    await upload(slug, 'md', markdownFile('Care', [['Velvet', 'Brush velvet with a quokkafur brush.']]));
    await upload(
      slug,
      'md',
      markdownFile('Care', [
        ['Velvet', 'Vacuum velvet with a wombatnose nozzle.'],
        ['Leather', 'Wipe leather with a damp cloth.'],
      ]),
    );
    expect(await found('quokkafur')).toEqual([]);
    expect(await found('wombatnose')).toHaveLength(1);

    const result = await rollbackToVersion(await versionId(slug, 1));

    expect(result).toMatchObject({ ok: true, version: 1, mode: 'switched', restoredFrom: 1, chunks: 1 });
    expect(await found('quokkafur')).toHaveLength(1);
    expect(await found('wombatnose')).toEqual([]);
    const versions = await listVersions(slug);
    expect(versions.map((row) => [row.version, row.isCurrent])).toEqual([
      [2, false],
      [1, true],
    ]);
    expect((await documentRow(versions[1].id)).editedInAdmin).toBe(true);
  });

  it('keeps the on/off switch where the admin left it', async () => {
    const slug = unique('switch-off');
    const old = await seedVersion(slug, 1, { chunks: ['Old text.'] });
    await seedVersion(slug, 2, { current: true, enabled: false, chunks: ['New text.'] });

    await rollbackToVersion(old.id);

    expect((await documentRow(old.id)).enabled).toBe(false);
    expect(await visibleBodies(slug)).toEqual([]);
  });

  it('never leaves two current versions of one document', async () => {
    const slug = unique('one-current');
    const first = await seedVersion(slug, 1, { chunks: ['One.'] });
    await seedVersion(slug, 2, { chunks: ['Two.'] });
    await seedVersion(slug, 3, { current: true, chunks: ['Three.'] });

    await rollbackToVersion(first.id);

    const rows = await db.select().from(s.kbDocuments).where(eq(s.kbDocuments.slug, slug));
    expect(rows.filter((row) => row.isCurrent).map((row) => row.version)).toEqual([1]);
  });

  it('refuses the current version and versions that do not exist', async () => {
    const slug = unique('refuse');
    const current = await seedVersion(slug, 1, { current: true, chunks: ['Only.'] });

    expect(await rollbackToVersion(current.id)).toEqual({
      ok: false,
      error: 'Version 1 is already the current version.',
    });
    expect(await rollbackToVersion(999_999)).toEqual({ ok: false, error: 'That version no longer exists.' });
  });

  it('rebuilds the chunks from the stored file when none are stored', async () => {
    const slug = unique('rebuild');
    await upload(
      slug,
      'md',
      markdownFile('Rebuild', [
        ['Returns', 'Returns are settled at your visit, says the platypusnote.'],
        ['Care', 'Brush velvet gently.'],
      ]),
    );
    await upload(slug, 'md', markdownFile('Rebuild', [['Returns', 'A different text.']]));
    await db.delete(s.kbChunks).where(eq(s.kbChunks.documentId, await versionId(slug, 1)));

    const result = await rollbackToVersion(await versionId(slug, 1));

    expect(result).toMatchObject({ ok: true, version: 3, mode: 'restored', restoredFrom: 1, chunks: 2 });
    expect(await found('platypusnote')).toHaveLength(1);
    const current = (await listVersions(slug)).find((row) => row.isCurrent);
    expect(current?.version).toBe(3);
    expect((await documentRow(current?.id ?? 0)).editedInAdmin).toBe(true);
  });

  it('rebuilds from the stored file instead of switching while embeddings are on', async () => {
    const slug = unique('embeddings-on');
    await upload(slug, 'md', markdownFile('E', [['Care', 'Brush velvet with a numbatbrush.']]));
    await upload(slug, 'md', markdownFile('E', [['Care', 'Something else entirely.']]));
    const value = { embeddings: { enabled: true, model: 'vendor/embed', dim: 8 } };
    await db
      .insert(s.settings)
      .values({ key: 'chat', value })
      .onConflictDoUpdate({ target: s.settings.key, set: { value } });

    try {
      const result = await rollbackToVersion(await versionId(slug, 1));

      expect(result).toMatchObject({ ok: true, mode: 'restored', restoredFrom: 1, version: 3 });
      expect(await found('numbatbrush')).toHaveLength(1);
    } finally {
      await db.delete(s.settings).where(eq(s.settings.key, 'chat'));
    }
  });

  it('applies the entries of a FAQ file again', async () => {
    const slug = unique('faq-file');
    const question = unique('Is the dugongfee free');
    const file = (answer: string) => JSON.stringify([{ q: question, a: answer, alt: ['free?'], tags: ['delivery'] }]);
    await upload(slug, 'json', file('First answer.'));
    await upload(slug, 'json', file('Second answer.'));
    const answerOf = async () => (await db.select().from(s.faqs).where(eq(s.faqs.question, question)))[0]?.answer;
    expect(await answerOf()).toBe('Second answer.');

    const result = await rollbackToVersion(await versionId(slug, 1));

    expect(result).toMatchObject({ ok: true, mode: 'restored', restoredFrom: 1, version: 3 });
    expect(await answerOf()).toBe('First answer.');
  });

  it('says so when the original file was not kept', async () => {
    const slug = unique('no-file');
    const old = await seedVersion(slug, 1);
    await seedVersion(slug, 2, { current: true, chunks: ['Kept.'] });

    expect(await rollbackToVersion(old.id)).toEqual({
      ok: false,
      error: 'The original file for version 1 was not kept, so it cannot be restored.',
    });
    expect(await visibleBodies(slug)).toEqual(['Kept.']);
  });

  it('reports a file that no longer passes the format check, and leaves the current version alone', async () => {
    const slug = unique('broken');
    const old = await seedVersion(slug, 1, { fileText: 'No front matter in this file.' });
    await seedVersion(slug, 2, { current: true, chunks: ['Fine.'] });

    const result = await rollbackToVersion(old.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/^Version 1 no longer passes the format check: /);
    expect(await visibleBodies(slug)).toEqual(['Fine.']);
  });

  it('does not save a copy when the old text equals the current text', async () => {
    const slug = unique('same');
    const same = markdownFile('Same', [['A', 'The same text.']]);
    await upload(slug, 'md', same);
    await upload(slug, 'md', markdownFile('Same', [['A', 'Different text.']]));
    await upload(slug, 'md', same);
    await db.delete(s.kbChunks).where(eq(s.kbChunks.documentId, await versionId(slug, 1)));

    const result = await rollbackToVersion(await versionId(slug, 1));

    expect(result).toEqual({ ok: false, error: 'Version 1 has the same text as the current version.' });
    expect(await listVersions(slug)).toHaveLength(3);
  });

  it('marks a saved upload as admin-owned and keeps the switch when a new version arrives', async () => {
    const slug = unique('owned');
    const text = (n: number) => markdownFile('Owned', [['A', `Version ${n}.`]]);
    await upload(slug, 'md', text(1));
    expect(await setDocumentEnabled(await versionId(slug, 1), false)).toBe(true);

    await upload(slug, 'md', text(2));

    const row = await documentRow(await versionId(slug, 2));
    expect(row.editedInAdmin).toBe(true);
    expect(row.enabled).toBe(false);
  });
});

describe('checking a file before it is saved', () => {
  const markdown = markdownFile('Delivery', [['Timing', 'The team confirms it.']], {
    frontMatter: ['tags: [delivery]', 'priority: high'],
    intro: 'Intro line.',
  });

  it('shows the chunks the bot will read, with heading path, text and tags', async () => {
    const response = await previewKnowledge({ fileName: 'Delivery Info.md', text: markdown });

    expect(response.ok).toBe(true);
    if (!response.ok) return;
    expect(response.preview).toMatchObject({
      slug: 'delivery-info',
      title: 'Delivery',
      tags: ['delivery'],
      priority: 'high',
      currentVersion: null,
    });
    expect(response.preview.chunks.map((chunk) => [chunk.headingPath, chunk.body, chunk.tags])).toEqual([
      ['Delivery', 'Intro line.', ['delivery']],
      ['Delivery › Timing', 'The team confirms it.', ['delivery']],
    ]);
  });

  it('names the version it would replace', async () => {
    const slug = unique('replace');
    await upload(slug, 'md', markdownFile('Replace', [['A', 'One.']]));

    const response = await previewKnowledge({ fileName: `${slug}.md`, text: markdown });

    expect(response.ok && response.preview.currentVersion).toBe(1);
  });

  it('reports front matter problems with their line numbers', async () => {
    const text = '---\ntitle: Delivery\npriority: urgent\n---\n\n## A\nText';

    const response = await previewKnowledge({ fileName: 'bad.md', text });

    expect(response.ok).toBe(false);
    if (response.ok) return;
    expect(response.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ line: 3, message: expect.stringContaining('priority') }),
        expect.objectContaining({ message: expect.stringContaining('tags') }),
      ]),
    );
  });

  it('reports invalid JSON with the line it broke on', async () => {
    const text = ['[', '  {"q": "One", "a": "Two"},', '  {"q": }', ']'].join('\n');

    const response = await previewKnowledge({ fileName: 'faqs.json', text });

    expect(response.ok).toBe(false);
    if (response.ok) return;
    expect(response.errors).toHaveLength(1);
    expect(response.errors[0].line).toBe(3);
  });

  it('numbers incomplete FAQ entries from 1', async () => {
    const text = JSON.stringify([{ q: 'Fine', a: 'Yes' }, { q: 'No answer' }, { a: 'No question' }]);

    const response = await previewKnowledge({ fileName: 'faqs.json', text });

    expect(response.ok).toBe(false);
    if (response.ok) return;
    expect(response.errors.map((error) => error.message)).toEqual([
      expect.stringContaining('Entry 2, "a"'),
      expect.stringContaining('Entry 3, "q"'),
    ]);
  });

  it('counts FAQs and synonym terms', async () => {
    const faqs = await previewKnowledge({ fileName: 'more-faqs.json', text: '[{"q":"One","alt":["1"],"a":"Yes"}]' });
    const terms = await previewKnowledge({ fileName: 'more-terms.json', text: '{"sofa":["couch"],"bed":["cot"]}' });

    expect(faqs.ok && faqs.preview).toMatchObject({ contentType: 'FAQ list', faqs: 1, synonyms: 0 });
    expect(terms.ok && terms.preview).toMatchObject({ contentType: 'Synonym list', faqs: 0, synonyms: 2 });
  });

  it('refuses the wrong type, an empty file and a file over 1 MB', () => {
    expect(validateUpload({ fileName: 'notes.txt', text: 'hi' })).toMatchObject({ ok: false });
    expect(validateUpload({ fileName: 'empty.md', text: '' })).toMatchObject({ ok: false });
    const big = validateUpload({ fileName: 'big.md', text: 'x'.repeat(1024 * 1024 + 1) });
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.errors[0].message).toBe('The file is larger than 1 MB.');
    expect(validateUpload({ fileName: 'Good File.MD', text: 'hello' })).toEqual({
      ok: true,
      file: { slug: 'good-file', kind: 'md', text: 'hello' },
    });
  });

  it('shows broken JSON on a save too, with the right line', async () => {
    const result = await saveUpload({ fileName: unique('broken-save') + '.json', text: '[\n  {"q": }\n]' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0].line).toBe(2);
  });
});

describe('FAQs', () => {
  it('creates, edits and deletes an FAQ', async () => {
    const created = await saveFaq({
      question: '  Do you offer layaway?  ',
      alternatives: 'layaway plan\n\n pay in parts ',
      answer: 'Ask the team at your visit.',
      tags: 'Payment, store info',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.faq).toMatchObject({
      question: 'Do you offer layaway?',
      alternatives: ['layaway plan', 'pay in parts'],
      tags: ['payment', 'store_info'],
      source: 'admin',
      enabled: true,
      hitCount: 0,
    });

    const edited = await saveFaq(
      {
        question: 'Do you offer layaway?',
        alternatives: ['layaway plan'],
        answer: 'The team explains payment options at your visit.',
        tags: ['payment'],
        enabled: false,
      },
      { id: created.faq.id },
    );
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.faq).toMatchObject({
      id: created.faq.id,
      answer: 'The team explains payment options at your visit.',
      alternatives: ['layaway plan'],
      enabled: false,
    });

    expect(await deleteFaq(created.faq.id)).toBe(true);
    expect(await deleteFaq(created.faq.id)).toBe(false);
    const rows = await db.select().from(s.faqs).where(eq(s.faqs.id, created.faq.id));
    expect(rows).toHaveLength(0);
  });

  it('rejects an empty question or answer with a message for each field', async () => {
    const result = await saveFaq({ question: ' ', answer: '', alternatives: '', tags: '' });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors).sort()).toEqual(['answer', 'question']);
  });

  it('rejects a question that already has an FAQ, ignoring case and spacing', async () => {
    const question = unique('Is  the sofa washable');
    const first = await saveFaq({ question, answer: 'Spot clean only.', alternatives: '', tags: '' });
    expect(first.ok).toBe(true);

    const duplicate = await saveFaq({
      question: question.toUpperCase().replace(/ {2}/, ' '),
      answer: 'Other.',
      alternatives: '',
      tags: '',
    });

    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.fieldErrors.question).toContain('already an FAQ');
  });

  it('reports an edit of an FAQ that was deleted meanwhile', async () => {
    const ghost = { question: 'Ghost question', answer: 'Boo', alternatives: '', tags: '' };

    const result = await saveFaq(ghost, { id: 999_999 });

    expect(result).toMatchObject({ ok: false, error: 'That FAQ no longer exists.' });
  });

  it('puts a gap back in the queue when the FAQ that answered it is deleted', async () => {
    const [gap] = await db
      .insert(s.knowledgeGaps)
      .values({ question: unique('gap-delete'), normalised: unique('gap-delete-n') })
      .returning();
    const form = { question: gap.question, answer: 'An answer.', alternatives: '', tags: '' };
    const answered = await answerGap(gap.id, form);
    expect(answered.ok).toBe(true);
    if (!answered.ok) return;

    await deleteFaq(answered.faqId);

    const [after] = await db.select().from(s.knowledgeGaps).where(eq(s.knowledgeGaps.id, gap.id));
    expect(after).toMatchObject({ status: 'open', resolvedFaqId: null });
  });
});

describe('knowledge gaps', () => {
  async function openGap(question: string, timesAsked = 1) {
    const [gap] = await db
      .insert(s.knowledgeGaps)
      .values({ question, normalised: question.toLowerCase(), timesAsked })
      .returning();
    return gap;
  }

  it('turns a gap into an FAQ and marks the gap answered', async () => {
    const gap = await openGap(unique('do u deliver to jaffna'), 4);

    const result = await answerGap(gap.id, {
      question: unique('Do you deliver to Jaffna?'),
      alternatives: 'jaffna delivery',
      answer: 'The team confirms delivery to your area.',
      tags: 'delivery',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [faq] = await db.select().from(s.faqs).where(eq(s.faqs.id, result.faqId));
    expect(faq).toMatchObject({ source: 'gap', answer: 'The team confirms delivery to your area.', enabled: true });
    expect(faq.alternatives).toContain(gap.question);
    expect(faq.alternatives).toContain('jaffna delivery');
    const [after] = await db.select().from(s.knowledgeGaps).where(eq(s.knowledgeGaps.id, gap.id));
    expect(after).toMatchObject({ status: 'answered', resolvedFaqId: result.faqId });
  });

  it('does not repeat the question as its own alternative', async () => {
    const question = unique('same words');
    const gap = await openGap(question);

    const result = await answerGap(gap.id, { question, alternatives: '', answer: 'An answer.', tags: '' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [faq] = await db.select().from(s.faqs).where(eq(s.faqs.id, result.faqId));
    expect(faq.alternatives).toEqual([]);
  });

  it('answers a gap only once', async () => {
    const gap = await openGap(unique('only once'));
    const input = { question: unique('Only once?'), alternatives: '', answer: 'Yes.', tags: '' };
    expect((await answerGap(gap.id, input)).ok).toBe(true);

    const again = await answerGap(gap.id, { ...input, question: unique('Only once again?') });

    expect(again).toMatchObject({ ok: false, error: 'That question has already been handled.' });
  });

  it('writes nothing when the form is invalid, and keeps the gap open', async () => {
    const gap = await openGap(unique('invalid form'));
    const before = await db.select().from(s.faqs);

    const result = await answerGap(gap.id, { question: gap.question, answer: '', alternatives: '', tags: '' });

    expect(result.ok).toBe(false);
    expect(await db.select().from(s.faqs)).toHaveLength(before.length);
    const [after] = await db.select().from(s.knowledgeGaps).where(eq(s.knowledgeGaps.id, gap.id));
    expect(after.status).toBe('open');
  });

  it('refuses a duplicate FAQ question and leaves the gap open', async () => {
    const question = unique('Duplicate through a gap?');
    expect((await saveFaq({ question, answer: 'First.', alternatives: '', tags: '' })).ok).toBe(true);
    const gap = await openGap(unique('dup gap'));

    const result = await answerGap(gap.id, { question, answer: 'Second.', alternatives: '', tags: '' });

    expect(result.ok).toBe(false);
    const [after] = await db.select().from(s.knowledgeGaps).where(eq(s.knowledgeGaps.id, gap.id));
    expect(after.status).toBe('open');
  });

  it('dismisses an open gap but not one that was answered', async () => {
    const dismissable = await openGap(unique('dismiss me'));
    const answered = await openGap(unique('already answered'));
    await answerGap(answered.id, { question: unique('Answered?'), answer: 'Yes.', alternatives: '', tags: '' });

    expect(await dismissGap(dismissable.id)).toBe(true);
    expect(await dismissGap(answered.id)).toBe(false);
    const [row] = await db.select().from(s.knowledgeGaps).where(eq(s.knowledgeGaps.id, dismissable.id));
    expect(row.status).toBe('dismissed');
  });
});

describe('synonyms', () => {
  it('imports a valid file, trimming and removing repeats', () => {
    const parsed = parseSynonymImport('{ "L-Shape": [" corner sofa ", "Corner Sofa", "l-shape", "sectional"] }');

    expect(parsed).toEqual({
      ok: true,
      entries: [{ term: 'L-Shape', variants: ['corner sofa', 'sectional'] }],
    });
  });

  it('reports invalid JSON with a line number', () => {
    const parsed = parseSynonymImport('{\n  "sofa": ["couch"],\n  "bed": [\n}');

    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.errors[0]).toMatchObject({ line: expect.any(Number) });
  });

  it('rejects a list, an empty object and a file that is too big', () => {
    expect(parseSynonymImport('[]')).toMatchObject({ ok: false });
    expect(parseSynonymImport('{}')).toMatchObject({
      ok: false,
      errors: [{ message: 'The file has no terms in it.' }],
    });
    const big = parseSynonymImport(JSON.stringify({ sofa: ['x'.repeat(1024 * 1024)] }));
    expect(big).toMatchObject({ ok: false, errors: [{ message: 'The file is larger than 1 MB.' }] });
  });

  it('reports every bad term on its own line', () => {
    const text = [
      '{',
      '  "sofa": ["couch"],',
      '  "bed": "cot",',
      '  "": ["x"],',
      '  "chair": [],',
      '  "pouffe": ["pouffe"]',
      '}',
    ].join('\n');

    const parsed = parseSynonymImport(text);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.errors.map((error) => error.line)).toEqual([3, 4, 5, 6]);
    expect(parsed.errors[0].message).toContain('"bed"');
    expect(parsed.errors[3].message).toContain('differs from the term');
  });

  it('writes nothing when any term is invalid', async () => {
    const term = unique('atomic');
    const result = await importSynonyms(JSON.stringify({ [term]: ['fine'], broken: [] }));

    expect(result.ok).toBe(false);
    expect(await db.select().from(s.synonyms).where(eq(s.synonyms.term, term))).toHaveLength(0);
  });

  it('adds new terms, replaces the variants of existing ones and leaves other terms alone', async () => {
    const kept = unique('kept');
    const changed = unique('changed');
    const fresh = unique('fresh');
    await saveSynonym({ term: kept, variants: ['stays'] });
    await saveSynonym({ term: changed, variants: ['old word'] });

    const result = await importSynonyms(JSON.stringify({ [changed]: ['new word', 'newer word'], [fresh]: ['first'] }));

    expect(result).toEqual({ ok: true, imported: 2, created: 1, updated: 1 });
    const stored = await exportSynonyms();
    expect(stored[kept]).toEqual(['stays']);
    expect(stored[changed]).toEqual(['new word', 'newer word']);
    expect(stored[fresh]).toEqual(['first']);
  });

  it('saves a term from the chip editor and refuses an empty variant list', async () => {
    const term = unique('chips');

    expect(await saveSynonym({ term, variants: ['one', ' two '] })).toEqual({
      ok: true,
      entry: { term, variants: ['one', 'two'] },
    });
    expect(await saveSynonym({ term, variants: [] })).toMatchObject({ ok: false });
    expect(await saveSynonym({ term, variants: [term] })).toMatchObject({
      ok: false,
      error: 'Add at least one variant that differs from the term.',
    });
    expect((await exportSynonyms())[term]).toEqual(['one', 'two']);
  });
});

describe('chat settings', () => {
  const form = {
    models: 'vendor/model-a:free, vendor/model-b\nvendor/model-a:free',
    dailyModelBudget: '60',
    perSessionModelAnswers: '4',
    messagesPer10Min: '15',
    temperature: '0.3',
    maxTokens: '300',
  };

  beforeEach(async () => {
    await db.delete(s.settings).where(eq(s.settings.key, 'chat'));
  });

  async function stored() {
    const [row] = await db.select().from(s.settings).where(eq(s.settings.key, 'chat'));
    return row?.value as Record<string, unknown>;
  }

  it('merges the form into the stored row and keeps the fields the form does not show', async () => {
    const embeddings = { enabled: true, model: 'vendor/embed', dim: 768 };
    await db.insert(s.settings).values({
      key: 'chat',
      value: { dailyModelBudget: 45, timeoutMs: 9000, bufferCalls: 7, embeddings },
    });

    const result = await saveChatSettings(form);

    expect(result.ok).toBe(true);
    expect(await stored()).toMatchObject({
      models: ['vendor/model-a:free', 'vendor/model-b'],
      dailyModelBudget: 60,
      perSessionModelAnswers: 4,
      messagesPer10Min: 15,
      temperature: 0.3,
      maxTokens: 300,
      timeoutMs: 9000,
      bufferCalls: 7,
      embeddings,
    });
  });

  it('fills the fields that were never stored from the defaults', async () => {
    await saveChatSettings(form);

    expect(await stored()).toMatchObject({ timeoutMs: 15_000, embeddings: { enabled: false } });
  });

  it('stores null when the list matches the server default, so it keeps following the environment', async () => {
    await saveChatSettings({ ...form, models: chatModels().join(', ') });

    expect((await stored()).models).toBeNull();
  });

  it('treats a blank model list as the default', async () => {
    await saveChatSettings({ ...form, models: '  ' });

    expect((await stored()).models).toBeNull();
  });

  it('refuses out-of-range values with a message per field and stores nothing', async () => {
    const result = await saveChatSettings({
      ...form,
      dailyModelBudget: '-1',
      temperature: '5',
      maxTokens: 'lots',
      messagesPer10Min: '2.5',
      models: 'not a model id',
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors).sort()).toEqual([
      'dailyModelBudget',
      'maxTokens',
      'messagesPer10Min',
      'models',
      'temperature',
    ]);
    expect(await stored()).toBeUndefined();
  });

  it('requires every number', async () => {
    const result = await saveChatSettings({ ...form, dailyModelBudget: '' });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.fieldErrors.dailyModelBudget).toBeDefined();
  });
});

describe('golden test comparison', () => {
  beforeEach(async () => {
    await db.delete(s.settings).where(eq(s.settings.key, 'chat_eval_last'));
  });

  it('says whether relevance went up, down or stayed the same', () => {
    expect(compareEval(0.9, null)).toEqual({ direction: 'first', changePoints: null });
    expect(compareEval(0.9, 0.8)).toEqual({ direction: 'up', changePoints: 10 });
    expect(compareEval(0.75, 0.8)).toEqual({ direction: 'down', changePoints: -5 });
    expect(compareEval(0.8, 0.8)).toEqual({ direction: 'same', changePoints: 0 });
  });

  it('stores each run next to the one before it', async () => {
    expect(await readLastEval()).toBeNull();

    golden.result = { total: 10, hitAt3: 0.8, intentAccuracy: 0.9, answeredWithoutModel: 0.5, failures: [] };
    const first = await runAndStoreEval();
    expect(first.previous).toBeNull();
    expect(toEvalView(first).direction).toBe('first');

    golden.result = {
      total: 10,
      hitAt3: 0.7,
      intentAccuracy: 0.9,
      answeredWithoutModel: 0.5,
      failures: [{ id: 'q1', question: 'Where?', reason: 'expected fact missing' }],
    };
    const second = await runAndStoreEval();

    expect(second.previous?.hitAt3).toBe(0.8);
    const view = toEvalView((await readLastEval()) ?? second);
    expect(view).toMatchObject({ direction: 'down', changePoints: -10, hitAt3: 0.7 });
    expect(view.failures).toEqual([{ id: 'q1', question: 'Where?', reason: 'expected fact missing' }]);
  });
});
