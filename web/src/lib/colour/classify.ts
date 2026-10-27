// Colour maths for the colour engine: sRGB hex → OKLab/OKLCH, then the
// nearest named family plus tone (light/mid/dark) and warmth (warm/cool/neutral).

export type Tone = 'light' | 'mid' | 'dark';
export type Warmth = 'warm' | 'cool' | 'neutral';
export type Oklab = { L: number; a: number; b: number };
export type Oklch = { L: number; C: number; h: number };

export const FAMILIES = [
  'white',
  'cream',
  'beige',
  'camel',
  'brown',
  'grey',
  'charcoal',
  'black',
  'green',
  'olive',
  'teal',
  'blue',
  'navy',
  'pink',
  'red',
  'maroon',
  'orange',
  'mustard',
  'purple',
  'gold',
  'multi',
] as const;
export type Family = (typeof FAMILIES)[number];

/** Families that pair with everything. */
export const NEUTRAL_FAMILIES: ReadonlySet<Family> = new Set(['white', 'cream', 'beige', 'grey', 'charcoal', 'black']);

/** Reference swatches for nearest-family matching (several per family where useful). */
const REFERENCES: Array<[Family, string]> = [
  ['white', '#F7F5F0'],
  ['cream', '#EDE3D1'],
  ['cream', '#E9DCC3'],
  ['beige', '#D8C7A8'],
  ['beige', '#C9B79A'],
  ['camel', '#C19A6B'],
  ['camel', '#A97C50'],
  ['brown', '#6F4E37'],
  ['brown', '#8B5A2B'],
  ['brown', '#4A3226'],
  ['grey', '#9A9B9D'],
  ['grey', '#B9B8B5'],
  ['charcoal', '#4A4D50'],
  ['black', '#1C1C1E'],
  ['green', '#2F6B4F'],
  ['green', '#1F5E46'],
  ['green', '#6E9E4F'],
  ['green', '#9DBF3A'],
  ['olive', '#6B6B3A'],
  ['teal', '#2E7D7A'],
  ['blue', '#3A5A8C'],
  ['blue', '#7FA3C8'],
  ['blue', '#2C4C8C'],
  ['navy', '#1F2A44'],
  ['pink', '#D4A5A5'],
  ['pink', '#E8B4BC'],
  ['red', '#B03A2E'],
  ['maroon', '#6B1F2A'],
  ['maroon', '#5A1A1F'],
  ['orange', '#C1622F'],
  ['orange', '#D9822B'],
  ['mustard', '#D4A72C'],
  ['purple', '#6B4E8C'],
  ['gold', '#C9A227'],
];

export function normaliseHex(input: string): string {
  let hex = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) hex = hex.replace(/./g, (c) => c + c);
  if (!/^[0-9a-f]{6}$/i.test(hex)) throw new Error(`Invalid hex colour: ${input}`);
  return `#${hex.toUpperCase()}`;
}

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export function hexToOklab(hex: string): Oklab {
  const n = normaliseHex(hex);
  const r = srgbToLinear(Number.parseInt(n.slice(1, 3), 16) / 255);
  const g = srgbToLinear(Number.parseInt(n.slice(3, 5), 16) / 255);
  const b = srgbToLinear(Number.parseInt(n.slice(5, 7), 16) / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function hexToOklch(hex: string): Oklch {
  const { L, a, b } = hexToOklab(hex);
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return { L, C: Math.sqrt(a * a + b * b), h: h < 0 ? h + 360 : h };
}

const REFERENCE_LAB = REFERENCES.map(([family, hex]) => ({ family, lab: hexToOklab(hex) }));

export function nearestFamily(hex: string): Family {
  const lab = hexToOklab(hex);
  let best: Family = 'grey';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const ref of REFERENCE_LAB) {
    // Lightness differences matter less than hue/chroma for naming a colour.
    const d = ((lab.L - ref.lab.L) * 0.7) ** 2 + (lab.a - ref.lab.a) ** 2 + (lab.b - ref.lab.b) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = ref.family;
    }
  }
  return best;
}

export function toneOf(hex: string): Tone {
  const { L } = hexToOklab(hex);
  if (L >= 0.78) return 'light';
  if (L <= 0.48) return 'dark';
  return 'mid';
}

export function warmthOf(hex: string): Warmth {
  const { C, h } = hexToOklch(hex);
  if (C < 0.035) return 'neutral';
  // Reds, oranges, yellows and browns read warm; greens through violets read cool.
  if (h < 105 || h >= 330) return 'warm';
  return 'cool';
}

export type ColourClass = { family: Family; tone: Tone; warmth: Warmth };

export function classifyHex(hex: string): ColourClass {
  return { family: nearestFamily(hex), tone: toneOf(hex), warmth: warmthOf(hex) };
}

/** Perceptual distance between two hexes (0 = identical, ~0.4+ = very different). */
export function hueDistance(a: string, b: string): number {
  const x = hexToOklab(a);
  const y = hexToOklab(b);
  return Math.sqrt((x.L - y.L) ** 2 + (x.a - y.a) ** 2 + (x.b - y.b) ** 2);
}
