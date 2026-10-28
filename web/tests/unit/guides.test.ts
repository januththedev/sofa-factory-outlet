import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GuideError,
  loadGuideBySlug,
  loadGuides,
  loadGuidesReport,
  parseGuide,
  pickRelated,
  readingMinutes,
  renderGuideMarkdown,
} from '@/lib/guides';

const FIXTURES = path.join(process.cwd(), 'tests', 'fixtures', 'guides');
const fixture = (name: string): string => readFileSync(path.join(FIXTURES, name), 'utf8');

describe('guide front matter', () => {
  it('parses every field the pages use', () => {
    const guide = parseGuide(fixture('fabric-guide.md'), 'fabric-guide.md');
    expect(guide).toMatchObject({
      title: 'Fabrics for humid homes',
      description: 'A fixture guide about fabrics, used by the unit tests.',
      slug: 'fabric-guide',
      author: 'Test Author',
      datePublished: '2025-01-15',
      dateModified: '2025-02-01',
      image: null,
      tags: ['fabric', 'care'],
      related: ['living-room-shapes', 'does-not-exist'],
    });
    expect(guide.markdown).toContain('Fabrics are the part of a sofa');
    expect(guide.readingMinutes).toBeGreaterThanOrEqual(1);
  });

  it('turns YAML dates (Date objects) into calendar days and fills the defaults', () => {
    const guide = parseGuide(fixture('living-room-shapes.md'));
    expect(guide.datePublished).toBe('2026-03-20');
    expect(guide.dateModified).toBeNull();
    expect(guide.tags).toEqual(['shapes']);
    expect(guide.image).toBeNull();
  });

  it('names the field at fault when required front matter is missing', () => {
    expect(() => parseGuide(fixture('missing-title.md'), 'missing-title.md')).toThrowError(GuideError);
    expect(() => parseGuide(fixture('missing-title.md'), 'missing-title.md')).toThrow(/title is required/);
    expect(() => parseGuide(fixture('bad-date.md'), 'bad-date.md')).toThrow(/datePublished must be a date/);
  });

  it('rejects an empty guide body', () => {
    const source = [
      '---',
      'title: Empty',
      'description: No body.',
      'slug: empty',
      'datePublished: 2026-01-01',
      'author: A',
      '---',
      '',
    ].join('\n');
    expect(() => parseGuide(source, 'empty.md')).toThrow(/no content/);
  });
});

describe('loading a directory of guides', () => {
  it('skips unusable files with a reason instead of crashing', async () => {
    const { guides, skipped } = await loadGuidesReport(FIXTURES);
    expect(guides.map((guide) => guide.slug)).toEqual(['living-room-shapes', 'fabric-guide']);
    const skippedFiles = skipped.map((entry) => entry.file).sort();
    expect(skippedFiles).toEqual(['bad-date.md', 'missing-title.md', 'zz-duplicate-slug.md']);
    expect(skipped.find((entry) => entry.file === 'missing-title.md')?.reason).toMatch(/title is required/);
    expect(skipped.find((entry) => entry.file === 'bad-date.md')?.reason).toMatch(/datePublished must be a date/);
    const duplicate = skipped.find((entry) => entry.file === 'zz-duplicate-slug.md');
    expect(duplicate?.reason).toMatch(/duplicate slug "fabric-guide"/);
  });

  it('sorts guides newest first', async () => {
    const guides = await loadGuides(FIXTURES);
    expect(guides.map((guide) => guide.datePublished)).toEqual(['2026-03-20', '2025-01-15']);
  });

  it('finds one guide by slug and reports unknown slugs as null', async () => {
    expect((await loadGuideBySlug('fabric-guide', FIXTURES))?.title).toBe('Fabrics for humid homes');
    expect(await loadGuideBySlug('no-such-guide', FIXTURES)).toBeNull();
  });

  it('resolves related guides, dropping unknown slugs and the guide itself', async () => {
    const guides = await loadGuides(FIXTURES);
    const fabric = guides.find((guide) => guide.slug === 'fabric-guide');
    if (!fabric) throw new Error('fabric-guide fixture is missing');
    expect(pickRelated(fabric, guides).map((guide) => guide.slug)).toEqual(['living-room-shapes']);
  });
});

describe('reading a guide', () => {
  it('estimates reading time from the word count, never below a minute', () => {
    expect(readingMinutes('')).toBe(1);
    expect(readingMinutes('word '.repeat(200))).toBe(1);
    expect(readingMinutes('word '.repeat(400))).toBe(2);
    expect(readingMinutes('word '.repeat(500))).toBe(3);
  });

  it('builds a table of contents whose ids match the rendered headings', () => {
    const guide = parseGuide(fixture('fabric-guide.md'));
    expect(guide.toc).toEqual([
      { id: 'care-basics', text: 'Care basics', depth: 2 },
      { id: 'vacuuming', text: 'Vacuuming', depth: 3 },
      { id: 'where-the-sofa-sits', text: 'Where the sofa sits', depth: 2 },
    ]);
    expect(guide.html).toContain('<h2 id="care-basics">');
    expect(guide.html).toContain('<h3 id="vacuuming">');
  });

  it('keeps repeated headings unique', () => {
    const { toc, html } = renderGuideMarkdown('## Care\n\n## Care\n');
    expect(toc.map((item) => item.id)).toEqual(['care', 'care-2']);
    expect(html).toContain('id="care-2"');
  });

  it('escapes raw HTML instead of rendering it', () => {
    const guide = parseGuide(fixture('fabric-guide.md'));
    expect(guide.html).not.toContain('<script>');
    expect(guide.html).not.toContain('<b>');
    expect(guide.html).toContain('&lt;script&gt;');
    expect(guide.html).toContain('&lt;b&gt;');
  });

  it('renders tables and keeps internal links clickable', () => {
    expect(parseGuide(fixture('living-room-shapes.md')).html).toContain('<table>');
    expect(parseGuide(fixture('fabric-guide.md')).html).toContain('<a href="/sofas/fabric/">');
  });
});
