import { describe, expect, it } from 'vitest';
import { parseJson, parseMarkdown } from '@/lib/kb/parse';

describe('knowledge parsing', () => {
  it('parses valid Markdown front matter', () => {
    const result = parseMarkdown('delivery', [
      '---',
      'title: Delivery',
      'tags: [delivery, store_info]',
      'priority: high',
      '---',
      '## Colombo',
      'Delivery details.',
    ].join('\n'));
    expect(result).toMatchObject({
      ok: true,
      document: { slug: 'delivery', title: 'Delivery', tags: ['delivery', 'store_info'], priority: 'high' },
    });
  });

  it('reports bad front matter with its source line', () => {
    const result = parseMarkdown('bad', [
      '---',
      'title: Bad',
      'tags: delivery',
      'priority: urgent',
      '---',
      'Text.',
    ].join('\n'));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ line: 3, message: expect.stringContaining('tags') }),
      expect.objectContaining({ line: 4, message: expect.stringContaining('priority') }),
    ]));
  });

  it('detects FAQ arrays and applies optional defaults', () => {
    const result = parseJson('faqs', '[{"q":"Opening time?","a":"Ask the showroom."}]');
    expect(result).toMatchObject({
      ok: true,
      document: { kind: 'faq', entries: [{ q: 'Opening time?', alt: [], tags: [] }] },
    });
  });

  it('detects synonym objects', () => {
    const result = parseJson('synonyms', '{"l-shape":["corner sofa","sectional"]}');
    expect(result).toMatchObject({
      ok: true,
      document: { kind: 'synonyms', entries: { 'l-shape': ['corner sofa', 'sectional'] } },
    });
  });

  it('reports the path of every invalid JSON entry', () => {
    const result = parseJson('faqs', '[{"q":"","a":4},{"q":"Valid","a":"Answer","tags":[2]}]');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((error) => error.message)).toEqual(expect.arrayContaining([
      expect.stringContaining('0.q'),
      expect.stringContaining('0.a'),
      expect.stringContaining('1.tags.0'),
    ]));
  });

  it('reports the line of malformed JSON', () => {
    const result = parseJson('broken', '{\n  "one": true,\n  broken\n}');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].line).toBeGreaterThanOrEqual(2);
  });
});
