import { classifyHex, type Family } from '../colour/classify';
import { findColourPhrase } from '../colour/dictionary';

// Facet derivation from product text. Sources are tried in order (name, alt,
// description, file name); anything derived is marked for review in admin.

export type Shape = 'l-shape' | 'u-shape' | 'set' | 'recliner' | 'single';
export type Material = 'velvet' | 'leather' | 'corduroy' | 'fabric';

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/[_\-]+/g, ' ');

export function deriveShape(sources: Array<string | null | undefined>): Shape | null {
  for (const raw of sources) {
    const s = norm(raw);
    if (!s) continue;
    if (/\bu shape|\bu shaped/.test(s)) return 'u-shape';
    if (/\bl shape|\bl shaped|\bcorner sofa|\bsectional/.test(s)) return 'l-shape';
    if (/\brecliner/.test(s)) return 'recliner';
    if (/3\s*\+\s*2\s*\+\s*1|\bsofa set\b|\bset with\b|\bseater set\b|\b3 piece\b/.test(s)) return 'set';
  }
  return null;
}

/**
 * A specific material (velvet, leather, corduroy) in any short source beats the
 * generic word "fabric": product copy often says "soft fabric" for a velvet sofa.
 * `specificSources` are short texts (name, alt, file name); long copy only counts
 * in the general pass, so a sentence like "unlike leather…" cannot win.
 */
export function deriveMaterial(
  sources: Array<string | null | undefined>,
  specificSources: Array<string | null | undefined> = sources,
): Material | null {
  for (const raw of specificSources) {
    const s = norm(raw);
    if (/\bvelvet\b/.test(s)) return 'velvet';
    if (/\bleather\b/.test(s)) return 'leather';
    if (/\bcorduroy\b/.test(s)) return 'corduroy';
  }
  for (const raw of sources) {
    const s = norm(raw);
    if (!s) continue;
    if (/\bvelvet\b/.test(s)) return 'velvet';
    if (/\bleather\b/.test(s)) return 'leather';
    if (/\bcorduroy\b/.test(s)) return 'corduroy';
    if (/\b(fabric|suede|linen|boucle|chenille|weave|woven)\b/.test(s)) return 'fabric';
  }
  return null;
}

export function deriveSeats(sources: Array<string | null | undefined>): number | null {
  for (const raw of sources) {
    const s = norm(raw);
    if (!s) continue;
    const seater = s.match(/\b(\d{1,2}) seater\b/);
    if (seater) return Number(seater[1]);
    if (/3\s*\+\s*2\s*\+\s*1/.test(s)) return 6;
  }
  return null;
}

export type DerivedColour = { name: string; hex: string; family: Family; tone: 'light' | 'mid' | 'dark'; warmth: 'warm' | 'cool' | 'neutral'; fromPhoto: boolean };

export function deriveColour(sources: Array<string | null | undefined>, photoDominant?: string): DerivedColour | null {
  for (const raw of sources) {
    const hit = findColourPhrase(norm(raw));
    if (hit) {
      const cls = classifyHex(hit.hex);
      return { name: hit.name, hex: hit.hex, family: hit.family ?? cls.family, tone: cls.tone, warmth: cls.warmth, fromPhoto: false };
    }
  }
  if (photoDominant) {
    const cls = classifyHex(photoDominant);
    const label = cls.family.charAt(0).toUpperCase() + cls.family.slice(1);
    return { name: label, hex: photoDominant, ...cls, fromPhoto: true };
  }
  return null;
}

const TAG_PATTERNS: Array<[string, RegExp]> = [
  ['chesterfield', /\bchesterfield\b/],
  ['modular', /\bmodular\b/],
  ['chaise', /\bchaise\b/],
  ['wing-chair', /\bwing ?chair|\bwingback/],
  ['with-ottoman', /\bwith ottomans?\b|\bmatching (square )?ottoman/],
  ['with-coffee-table', /\bwith coffee table\b|\bcoffee table\b/],
  ['3+2+1', /3\s*\+\s*2\s*\+\s*1/],
  ['outdoor', /\boutdoor\b/],
  ['office', /\boffice\b|\bexecutive\b/],
];

export function deriveTags(sources: Array<string | null | undefined>): string[] {
  const text = sources.map(norm).join(' ');
  return TAG_PATTERNS.filter(([, re]) => re.test(text)).map(([tag]) => tag);
}

// Alt text in the capture is either a long SEO sentence, a placeholder
// ("Bed Sheet", "Table"), a file-name echo ("bebitalia_table_Seven_…") or empty.
const GENERIC_ALT = /^(bed sheet|table|sofas?|chair|offer sofa.*|.*_.*|)$/i;

export function cleanAlt(alt: string | null | undefined): string | null {
  const a = (alt ?? '').replace(/\s+/g, ' ').trim();
  if (!a || GENERIC_ALT.test(a)) return null;
  let out = a.split(/\s+[—–]\s+/)[0];
  out = out.replace(/\s+(?:available|for living rooms? in|in colombo|at factory price)\b.*$/i, '');
  out = out.replace(/[.,;\s]+$/, '');
  return out.length >= 12 ? out.charAt(0).toUpperCase() + out.slice(1) : null;
}

export function generatedAlt(parts: {
  colourName?: string | null;
  material?: string | null;
  shape?: string | null;
  categoryNoun: string;
  name: string;
}): string {
  const shapeWords: Record<string, string> = {
    'l-shape': 'L-shape',
    'u-shape': 'U-shape',
    set: 'set',
    recliner: 'recliner',
    single: 'single',
  };
  const words = [
    parts.colourName?.toLowerCase(),
    parts.material,
    parts.shape ? shapeWords[parts.shape] : null,
    parts.shape === 'set' ? 'sofa' : parts.categoryNoun,
  ].filter(Boolean);
  const sentence = words.length > 1 ? words.join(' ') : `${parts.name} ${parts.categoryNoun}`;
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
