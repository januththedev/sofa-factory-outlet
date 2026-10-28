import { describe, expect, it } from 'vitest';
import { normalise, normaliseQuestion } from '@/lib/chat/normalise';

describe('chat normalisation', () => {
  it('expands English synonyms and corrects typos', () => {
    expect(normalise('  Soffa couch  ')).toContain('sofa');
  });

  it('converts lakh amounts to rupees', () => {
    expect(normalise('under 1.5 lakhs')).toContain('150000');
  });

  it('expands Singlish furniture phrases', () => {
    expect(normalise('sofa set mila')).toContain('sofa set price');
  });

  it('uses synonyms supplied by the database layer', () => {
    expect(normalise('divan', { divan: 'sofa' })).toBe('sofa');
  });

  it('produces stable FAQ keys', () => {
    expect(normaliseQuestion(' Hello!  Couch? ')).toBe('hello sofa');
  });
});
