import type { ExtractedDetails } from './extract';

// Words that say how someone asks, not what they want. The shop search needs every word to match, so
// one of these left in the text ("show" in "show me sofas") would match no product at all.
const FILLER = new Set([
  'a', 'about', 'an', 'any', 'anything', 'are', 'around', 'available', 'below', 'budget', 'buy', 'can',
  'could', 'do', 'does', 'find', 'for', 'get', 'give', 'got', 'have', 'i', 'im', 'in', 'is', 'it', 'less',
  'like', 'list', 'lkr', 'look', 'looking', 'me', 'my', 'need', 'of', 'on', 'option', 'options', 'our',
  'please', 'pls', 'recommend', 'rs', 'see', 'seat', 'seater', 'seaters', 'seats', 'show', 'some',
  'something', 'suggest', 'tell', 'than', 'the', 'there', 'to', 'u', 'under', 'up', 'want', 'wanna',
  'we', 'what', 'which', 'will', 'with', 'would', 'you', 'your',
]);

/**
 * What is left to search the catalogue text for once the filters have taken what they can: the
 * category, colour, material, shape, seat count and price are applied as filters instead.
 */
export function productSearchText(query: string, details: ExtractedDetails): string {
  const captured = new Set([details.colour, details.material, details.shape]);
  return query
    .split(' ')
    .filter((word) => word
      && !FILLER.has(word)
      && !captured.has(word)
      && !/^\d/.test(word)
      && word !== details.category
      && `${word}s` !== details.category)
    .join(' ');
}
