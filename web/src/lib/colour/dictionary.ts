import type { Family } from './classify';

/**
 * Colour phrases customers and product names use, with a representative hex.
 * Longest phrase wins, so "emerald green" beats "green".
 */
export const COLOUR_PHRASES: Array<{ phrase: string; name: string; hex: string; family?: Family }> = [
  { phrase: 'emerald green', name: 'Emerald green', hex: '#1F5E46' },
  { phrase: 'forest green', name: 'Forest green', hex: '#2F4F3A' },
  { phrase: 'deep green', name: 'Deep green', hex: '#24503C' },
  { phrase: 'lime green', name: 'Lime green', hex: '#9DBF3A' },
  { phrase: 'sage green', name: 'Sage green', hex: '#9CAF88' },
  { phrase: 'olive green', name: 'Olive green', hex: '#6B6B3A', family: 'olive' },
  { phrase: 'caramel brown', name: 'Caramel brown', hex: '#A0682F', family: 'camel' },
  { phrase: 'chocolate brown', name: 'Chocolate brown', hex: '#4A3226', family: 'brown' },
  { phrase: 'dark brown', name: 'Dark brown', hex: '#4A3226', family: 'brown' },
  { phrase: 'dusty pink', name: 'Dusty pink', hex: '#D4A5A5', family: 'pink' },
  { phrase: 'blush pink', name: 'Blush pink', hex: '#E8B4BC', family: 'pink' },
  { phrase: 'light blue', name: 'Light blue', hex: '#9DB8D3', family: 'blue' },
  { phrase: 'sky blue', name: 'Sky blue', hex: '#8DB6D9', family: 'blue' },
  { phrase: 'royal blue', name: 'Royal blue', hex: '#2C4C8C', family: 'blue' },
  { phrase: 'deep blue', name: 'Deep blue', hex: '#24406E', family: 'blue' },
  { phrase: 'navy blue', name: 'Navy blue', hex: '#1F2A44', family: 'navy' },
  { phrase: 'burnt orange', name: 'Burnt orange', hex: '#C1622F', family: 'orange' },
  { phrase: 'off white', name: 'Off-white', hex: '#F2EEE6', family: 'white' },
  { phrase: 'off-white', name: 'Off-white', hex: '#F2EEE6', family: 'white' },
  { phrase: 'dual-tone', name: 'Dual-tone', hex: '#6F6A64', family: 'multi' },
  { phrase: 'dual tone', name: 'Dual-tone', hex: '#6F6A64', family: 'multi' },
  { phrase: 'two-tone', name: 'Two-tone', hex: '#6F6A64', family: 'multi' },
  { phrase: 'emerald', name: 'Emerald green', hex: '#1F5E46' },
  { phrase: 'green', name: 'Green', hex: '#3E7A52' },
  { phrase: 'olive', name: 'Olive', hex: '#6B6B3A', family: 'olive' },
  { phrase: 'teal', name: 'Teal', hex: '#2E7D7A', family: 'teal' },
  { phrase: 'turquoise', name: 'Turquoise', hex: '#3AA6A0', family: 'teal' },
  { phrase: 'navy', name: 'Navy', hex: '#1F2A44', family: 'navy' },
  { phrase: 'blue', name: 'Blue', hex: '#3A5A8C', family: 'blue' },
  { phrase: 'grey', name: 'Grey', hex: '#8A8D91', family: 'grey' },
  { phrase: 'gray', name: 'Grey', hex: '#8A8D91', family: 'grey' },
  { phrase: 'charcoal', name: 'Charcoal', hex: '#4A4D50', family: 'charcoal' },
  { phrase: 'black', name: 'Black', hex: '#1C1C1E', family: 'black' },
  { phrase: 'white', name: 'White', hex: '#F7F5F0', family: 'white' },
  { phrase: 'ivory', name: 'Ivory', hex: '#F2EBDD', family: 'cream' },
  { phrase: 'cream', name: 'Cream', hex: '#EDE3D1', family: 'cream' },
  { phrase: 'beige', name: 'Beige', hex: '#D8C7A8', family: 'beige' },
  { phrase: 'sand', name: 'Sand', hex: '#D2BE9A', family: 'beige' },
  { phrase: 'taupe', name: 'Taupe', hex: '#A39383', family: 'beige' },
  { phrase: 'camel', name: 'Camel', hex: '#C19A6B', family: 'camel' },
  { phrase: 'tan', name: 'Tan', hex: '#C19A6B', family: 'camel' },
  { phrase: 'caramel', name: 'Caramel', hex: '#A0682F', family: 'camel' },
  { phrase: 'walnut', name: 'Walnut', hex: '#5C4033', family: 'brown' },
  { phrase: 'brown', name: 'Brown', hex: '#6F4E37', family: 'brown' },
  { phrase: 'chocolate', name: 'Chocolate', hex: '#4A3226', family: 'brown' },
  { phrase: 'pink', name: 'Pink', hex: '#E3A1B0', family: 'pink' },
  { phrase: 'blush', name: 'Blush', hex: '#E8B4BC', family: 'pink' },
  { phrase: 'maroon', name: 'Maroon', hex: '#6B1F2A', family: 'maroon' },
  { phrase: 'burgundy', name: 'Burgundy', hex: '#6E1E2C', family: 'maroon' },
  { phrase: 'wine', name: 'Wine', hex: '#6E1E2C', family: 'maroon' },
  { phrase: 'red', name: 'Red', hex: '#B03A2E', family: 'red' },
  { phrase: 'rust', name: 'Rust', hex: '#A4502A', family: 'orange' },
  { phrase: 'orange', name: 'Orange', hex: '#D9822B', family: 'orange' },
  { phrase: 'terracotta', name: 'Terracotta', hex: '#B5603F', family: 'orange' },
  { phrase: 'mustard', name: 'Mustard', hex: '#D4A72C', family: 'mustard' },
  { phrase: 'yellow', name: 'Yellow', hex: '#E2BE3A', family: 'mustard' },
  { phrase: 'purple', name: 'Purple', hex: '#6B4E8C', family: 'purple' },
  { phrase: 'lavender', name: 'Lavender', hex: '#A493C4', family: 'purple' },
  { phrase: 'gold', name: 'Gold', hex: '#C9A227', family: 'gold' },
  { phrase: 'brass', name: 'Brass', hex: '#B5A642', family: 'gold' },
];

const SORTED = [...COLOUR_PHRASES].sort((a, b) => b.phrase.length - a.phrase.length);

/** Finds the longest colour phrase in a piece of text. */
export function findColourPhrase(text: string | null | undefined) {
  if (!text) return null;
  const haystack = ` ${text.toLowerCase().replace(/[^a-z\- ]+/g, ' ').replace(/\s+/g, ' ')} `;
  for (const entry of SORTED) {
    if (haystack.includes(` ${entry.phrase} `)) return entry;
  }
  return null;
}

/** Plain-language family names used in filters and chat answers. */
export const FAMILY_LABELS: Record<Family, string> = {
  white: 'White',
  cream: 'Cream',
  beige: 'Beige',
  camel: 'Camel',
  brown: 'Brown',
  grey: 'Grey',
  charcoal: 'Charcoal',
  black: 'Black',
  green: 'Green',
  olive: 'Olive',
  teal: 'Teal',
  blue: 'Blue',
  navy: 'Navy',
  pink: 'Pink',
  red: 'Red',
  maroon: 'Maroon',
  orange: 'Orange',
  mustard: 'Mustard',
  purple: 'Purple',
  gold: 'Gold',
  multi: 'Multi-colour',
};
