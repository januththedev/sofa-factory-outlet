import { describe, expect, it } from 'vitest';
import { extractDetails } from '@/lib/chat/extract';
import { normalise } from '@/lib/chat/normalise';
import { productSearchText } from '@/lib/chat/search-text';

function searchTextFor(message: string): string {
  const query = normalise(message);
  return productSearchText(query, extractDetails(query));
}

describe('productSearchText', () => {
  it('leaves nothing to search for when the category is the whole request', () => {
    expect(searchTextFor('Show me sofas')).toBe('');
    expect(searchTextFor('Do you have any couch?')).toBe('');
  });

  it('drops what the filters already apply', () => {
    expect(searchTextFor('I want a grey velvet L-shape sofa under 200000')).toBe('');
    expect(searchTextFor('3 seater leather sofa, budget of 2 lakhs')).toBe('');
  });

  it('keeps the words that name the product', () => {
    expect(searchTextFor('Show me a sofa with a coffee table')).toBe('coffee table');
    expect(searchTextFor('looking for a chesterfield')).toBe('chesterfield');
  });

  it('keeps every word when no filter was extracted', () => {
    expect(searchTextFor('is it washable')).toBe('washable');
  });
});
