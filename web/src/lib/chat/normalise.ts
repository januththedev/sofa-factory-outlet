export type SynonymDictionary = Record<string, string | string[]>;

export const DEFAULT_SYNONYMS: SynonymDictionary = {
  couch: 'sofa',
  settee: 'sofa',
  'corner sofa': 'l-shape',
  'corner couch': 'l-shape',
  sectional: 'l-shape',
  'sofa set mila': 'sofa set price',
  mila: 'price',
  ganan: 'price',
  ganang: 'price',
  putuwa: 'chair',
  'sofa eka': 'sofa',
  'සෝෆා': 'sofa',
  'පුටුව': 'chair',
  'මිල': 'price',
  'කීයද': 'price',
  'කොවමද': 'how much',
  'சோபா': 'sofa',
  'விலை': 'price',
};

const TYPOS: Record<string, string> = {
  soffa: 'sofa',
  sofaa: 'sofa',
  delivary: 'delivery',
  warrenty: 'warranty',
  colur: 'colour',
  matrial: 'material',
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replacePhrase(value: string, phrase: string, replacement: string): string {
  const escaped = escapeRegExp(phrase.toLowerCase());
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, 'gu');
  return value.replace(pattern, (_match, prefix: string) => `${prefix}${replacement.toLowerCase()}`);
}

export function normalise(text: string, dictionary: SynonymDictionary = {}): string {
  let value = text
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}.+x×\s-]/gu, ' ')
    .replace(/\s+/g, ' ');

  for (const [wrong, right] of Object.entries(TYPOS)) {
    value = replacePhrase(value, wrong, right);
  }

  const merged = { ...DEFAULT_SYNONYMS, ...dictionary };
  const entries = Object.entries(merged).sort(([left], [right]) => right.length - left.length);
  for (const [term, replacements] of entries) {
    const replacement = Array.isArray(replacements) ? replacements.join(' ') : replacements;
    value = replacePhrase(value, term, replacement);
  }

  value = value.replace(
    /(\d+(?:\.\d+)?)\s*(?:lakhs?|lacs?)/g,
    (_match, amount: string) => String(Math.round(Number(amount) * 100_000)),
  );
  return value.replace(/\s+/g, ' ').trim();
}

export function normaliseQuestion(text: string, dictionary: SynonymDictionary = {}): string {
  return normalise(text, dictionary)
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}
