import { describe, expect, it } from 'vitest';
import { evaluateSeoChecklist, type SeoChecklistInput } from '@/lib/admin/seo-checklist';

const words = (count: number) => Array.from({ length: count }, (_, index) => `word${index}`).join(' ');

const valid: SeoChecklistInput = {
  name: 'A useful product title with enough detail',
  seoTitle: null,
  seoDescription: 'A practical description of this sofa with enough useful detail for a search result in Sri Lanka.',
  photoCount: 4,
  photosWithAlt: 4,
  descriptionMd: words(150),
  priceMinor: 100_000,
  tags: ['guide:sofa-care'],
};

describe('evaluateSeoChecklist', () => {
  it('returns green when all five checks pass', () => {
    expect(evaluateSeoChecklist(valid)).toMatchObject({ passed: 5, total: 5, score: 'green' });
  });

  it('uses the product name when the SEO title is blank', () => {
    expect(evaluateSeoChecklist({ ...valid, seoTitle: '  ' }).checks[0].pass).toBe(true);
  });

  it('applies inclusive metadata and copy boundaries', () => {
    const result = evaluateSeoChecklist({
      ...valid,
      seoTitle: 'x'.repeat(30),
      seoDescription: 'x'.repeat(70),
      descriptionMd: words(150),
    });
    expect(result.checks.find((check) => check.id === 'meta')?.pass).toBe(true);
    expect(result.checks.find((check) => check.id === 'copy')?.pass).toBe(true);
  });

  it('requires every photo to have alt text and at least four photos', () => {
    const result = evaluateSeoChecklist({ ...valid, photoCount: 5, photosWithAlt: 4 });
    expect(result.checks.find((check) => check.id === 'photos')?.pass).toBe(false);
  });

  it('returns amber for three or four passes and red below three', () => {
    const three = evaluateSeoChecklist({ ...valid, priceMinor: null, tags: [] });
    const two = evaluateSeoChecklist({ ...valid, priceMinor: null, tags: [], descriptionMd: words(149) });
    expect(three.score).toBe('amber');
    expect(two.score).toBe('red');
  });

  it('rejects malformed guide tags', () => {
    const result = evaluateSeoChecklist({ ...valid, tags: ['guide:', 'my-guide:valid'] });
    expect(result.checks.find((check) => check.id === 'guide')?.pass).toBe(false);
  });
});
