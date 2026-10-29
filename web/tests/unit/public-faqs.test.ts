import { describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));

import { faqPageJsonLd, groupFaqs, isPublishable } from '@/lib/seo/public-faqs';

const faq = (question: string, tags: string[], answer = 'An answer.') => ({ question, answer, tags });

describe('public FAQs', () => {
  it('keeps answers that still carry a placeholder off the public page', () => {
    expect(isPublishable({ answer: 'Opening hours are not confirmed for the new site yet.' })).toBe(false);
    expect(isPublishable({ answer: 'The address comes from the old site, so the team reconfirms it.' })).toBe(false);
    expect(isPublishable({ answer: 'Yes, you can choose the fabric, size and colour.' })).toBe(true);
  });

  it('puts each question in one section only, in page order, and drops empty sections', () => {
    const sections = groupFaqs([faq('A', ['care']), faq('B', ['buying', 'pricing']), faq('C', ['pricing'])]);
    expect(sections.map((section) => [section.id, section.items.map((item) => item.question)])).toEqual([
      ['buying', ['B']],
      ['materials', ['A']],
      ['prices', ['C']],
    ]);
  });

  it('marks the questions up as an FAQPage', () => {
    expect(faqPageJsonLd([faq('Q?', ['care'], 'A.')])).toEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: [{ '@type': 'Question', name: 'Q?', acceptedAnswer: { '@type': 'Answer', text: 'A.' } }],
    });
  });
});
