import type { ProductCard } from '../catalogue/queries';

const PRICE_PATTERN = /(?:LKR|Rs\.?|රු\.?)\s*[\d,]+(?:\.\d{1,2})?/gi;
const LINK_PATTERN = /(?:https?:\/\/|www\.)\S+|\b[a-z0-9.-]+\.(?:com|lk|net|org)\S*/gi;
const PHONE_PATTERN = /(?:\+?94|0)\s*\d(?:[\s()-]*\d){8,}/g;

function priceInMinorUnits(value: string): number {
  const amount = value.match(/[\d,]+(?:\.\d{1,2})?/);
  if (!amount) {
    return Number.NaN;
  }
  return Math.round(Number(amount[0].replaceAll(',', '')) * 100);
}

function hasInventedProductName(sentence: string, products: ProductCard[]): boolean {
  const knownNames = products.map((product) => product.name.toLowerCase());
  const labelledNames = [...sentence.matchAll(
    /(?:called|named|recommend|suggest|choose|the|our)\s+["']?([A-Z][\w'-]+(?:\s+[A-Z][\w'-]+){1,4})/g,
  )].map((match) => match[1].toLowerCase());

  return labelledNames.some((name) =>
    !knownNames.some((known) => known.includes(name) || name.includes(known)),
  );
}

export function verifyAnswer(answer: string, products: ProductCard[], maxWords = 80): string {
  const knownPrices = new Set(
    products
      .filter((product) => product.priceMinor !== null)
      .map((product) => product.priceMinor as number),
  );
  let clean = answer.replace(LINK_PATTERN, '').replace(PHONE_PATTERN, '');
  clean = clean.replace(PRICE_PATTERN, (price) =>
    knownPrices.has(priceInMinorUnits(price)) ? price : 'price on request',
  );
  clean = clean
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !hasInventedProductName(sentence, products))
    .join(' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const shortened = words.slice(0, maxWords).join(' ');
  return words.length > maxWords ? `${shortened}…` : shortened;
}
