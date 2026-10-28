import { describe, expect, it } from 'vitest';
import { chunkDocument } from '@/lib/kb/chunk';
import type { MarkdownDocument } from '@/lib/kb/parse';

function markdown(body: string): MarkdownDocument {
  return {
    kind: 'md',
    slug: 'delivery',
    title: 'Delivery',
    tags: ['delivery'],
    priority: 'high',
    body,
  };
}

describe('knowledge chunking', () => {
  it('chunks the intro and each level-two heading with its heading path', () => {
    const chunks = chunkDocument(markdown([
      'Introductory answer.',
      '',
      '## Inside Colombo',
      'Colombo answer.',
      '',
      '## Outside Colombo',
      'Island-wide answer.',
    ].join('\n')));
    expect(chunks.map((chunk) => chunk.headingPath)).toEqual([
      'Delivery',
      'Delivery › Inside Colombo',
      'Delivery › Outside Colombo',
    ]);
    expect(chunks[1]).toMatchObject({ tags: ['delivery'], priority: 'high', sortOrder: 1 });
  });

  it('splits long sections near 350 tokens with about 50 tokens of overlap', () => {
    const sentences = Array.from({ length: 90 }, (_, index) =>
      `Sentence ${index} contains several useful delivery words for a customer.`);
    const chunks = chunkDocument(markdown(`## Long section\n${sentences.join(' ')}`));
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every((chunk) => chunk.tokens <= 370)).toBe(true);
    const firstTail = chunks[0].body.split(/\s+/).slice(-30).join(' ');
    expect(chunks[1].body).toContain(firstTail);
  });

  it('is deterministic', () => {
    const document = markdown('## Care\nUse a dry cloth.\n\nKeep the room ventilated.');
    expect(chunkDocument(document)).toEqual(chunkDocument(document));
  });
});
