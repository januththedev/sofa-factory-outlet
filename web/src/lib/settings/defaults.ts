import type { SettingsMap } from './types';

/**
 * Seed values. Anything the client has not confirmed is marked
 * `confirmed: false`: the captured address and WhatsApp number come from the
 * old site's map embed and product copy; hours, slots, delivery terms and bank
 * details are placeholders until the client answers Plan.md's open questions.
 */
export const DEFAULT_SETTINGS: SettingsMap = {
  business: {
    name: 'Sofa Factory Outlet',
    tagline: 'Sofas made in our own Colombo workshop, sold at factory prices.',
    address: {
      street: '67 Pallidora Road',
      locality: 'Dehiwala',
      city: 'Colombo',
      postalCode: null,
      country: 'LK',
      confirmed: false,
    },
    phone: { number: null, confirmed: false },
    whatsapp: { number: '+94766711711', confirmed: false },
    email: { address: null, confirmed: false },
    social: { facebook: null, instagram: null, tiktok: null, youtube: null },
    map: { lat: null, lng: null, placeUrl: null, googleReviewUrl: null, confirmed: false },
    priceRange: 'LKR',
  },
  hours: {
    confirmed: false,
    timezone: 'Asia/Colombo',
    days: {
      mon: { open: '10:00', close: '18:00' },
      tue: { open: '10:00', close: '18:00' },
      wed: { open: '10:00', close: '18:00' },
      thu: { open: '10:00', close: '18:00' },
      fri: { open: '10:00', close: '18:00' },
      sat: { open: '10:00', close: '18:00' },
      sun: null,
    },
    closedDates: [],
    note: null,
  },
  booking: { leadDays: 1, horizonDays: 45, confirmed: false },
  invoice: {
    prefix: 'SFO',
    quotationPrefix: 'SFO-Q',
    taxEnabled: false,
    taxLabel: 'VAT',
    taxRateBp: 1800,
    vatNumber: null,
    bank: { bank: null, branch: null, accountName: null, accountNumber: null },
    terms: 'An advance confirms the order. The balance is due on delivery. Custom orders cannot be cancelled once production starts.',
    warranty: 'Structural warranty as agreed at purchase.',
    confirmed: false,
  },
  chat: {
    dailyModelBudget: 45,
    bufferCalls: 5,
    perSessionModelAnswers: 3,
    messagesPer10Min: 20,
    models: null,
    temperature: 0.2,
    maxTokens: 250,
    timeoutMs: 15_000,
    embeddings: { enabled: false, model: null, dim: null },
  },
  seo: { aiCrawlers: 'allow', indexNow: false },
  proof: { years: null, homes: null, districts: null, confirmed: false },
  delivery: {
    confirmed: false,
    colomboDays: '3–5 working days',
    islandwideDays: '10–15 working days',
    colomboCharge: 'Free for sofa sets (to be confirmed)',
    islandwideCharge: 'Depends on the district; confirmed at the showroom',
    warranty: '10-year structural warranty (as stated on the current site — to be confirmed)',
  },
};

/** Placeholder visit slots: Monday–Saturday, four 2-hour slots, three visits each. */
export const DEFAULT_SLOTS = [1, 2, 3, 4, 5, 6].flatMap((weekday) =>
  [
    ['10:00', '12:00'],
    ['12:00', '14:00'],
    ['14:00', '16:00'],
    ['16:00', '18:00'],
  ].map(([start, end]) => ({ weekday, start, end, capacity: 3 })),
);

/** Colour pairing table (Plan.md examples first). Verbs read "<candidate> <verb> <anchor>". */
export const DEFAULT_PAIRINGS: Array<{ family: string; pairsWith: string; weight: number; reason: string }> = [
  { family: 'green', pairsWith: 'cream', weight: 1, reason: 'soften' },
  { family: 'green', pairsWith: 'beige', weight: 0.9, reason: 'calm' },
  { family: 'green', pairsWith: 'mustard', weight: 0.9, reason: 'warm up' },
  { family: 'green', pairsWith: 'brown', weight: 0.8, reason: 'ground' },
  { family: 'grey', pairsWith: 'mustard', weight: 1, reason: 'bring warmth to' },
  { family: 'grey', pairsWith: 'teal', weight: 0.9, reason: 'add depth to' },
  { family: 'grey', pairsWith: 'pink', weight: 0.9, reason: 'lift' },
  { family: 'navy', pairsWith: 'camel', weight: 1, reason: 'warm up' },
  { family: 'navy', pairsWith: 'cream', weight: 0.9, reason: 'brighten' },
  { family: 'navy', pairsWith: 'gold', weight: 0.9, reason: 'add a brass glow to' },
  { family: 'blue', pairsWith: 'cream', weight: 0.9, reason: 'brighten' },
  { family: 'blue', pairsWith: 'camel', weight: 0.9, reason: 'warm up' },
  { family: 'blue', pairsWith: 'mustard', weight: 0.8, reason: 'add contrast to' },
  { family: 'pink', pairsWith: 'grey', weight: 0.9, reason: 'balance' },
  { family: 'pink', pairsWith: 'green', weight: 0.7, reason: 'freshen' },
  { family: 'maroon', pairsWith: 'cream', weight: 1, reason: 'soften' },
  { family: 'maroon', pairsWith: 'gold', weight: 0.9, reason: 'enrich' },
  { family: 'maroon', pairsWith: 'beige', weight: 0.8, reason: 'calm' },
  { family: 'brown', pairsWith: 'cream', weight: 0.9, reason: 'lighten' },
  { family: 'brown', pairsWith: 'teal', weight: 0.8, reason: 'cool down' },
  { family: 'camel', pairsWith: 'navy', weight: 0.9, reason: 'anchor' },
  { family: 'camel', pairsWith: 'green', weight: 0.8, reason: 'freshen' },
  { family: 'mustard', pairsWith: 'grey', weight: 0.9, reason: 'balance' },
  { family: 'mustard', pairsWith: 'navy', weight: 0.9, reason: 'deepen' },
  { family: 'orange', pairsWith: 'navy', weight: 0.9, reason: 'cool down' },
  { family: 'orange', pairsWith: 'teal', weight: 0.8, reason: 'balance' },
  { family: 'teal', pairsWith: 'mustard', weight: 0.9, reason: 'warm up' },
  { family: 'teal', pairsWith: 'brown', weight: 0.8, reason: 'ground' },
  { family: 'multi', pairsWith: 'cream', weight: 0.8, reason: 'calm' },
  { family: 'multi', pairsWith: 'grey', weight: 0.8, reason: 'calm' },
];

/** Which categories complete which (Plan.md: sofa → pillows, ottoman, coffee table …). */
export const DEFAULT_COMPLEMENTS: Array<{ category: string; complement: string; weight: number }> = [
  { category: 'sofas', complement: 'pillows', weight: 1 },
  { category: 'sofas', complement: 'ottomans', weight: 0.9 },
  { category: 'sofas', complement: 'coffee', weight: 0.9 },
  { category: 'sofas', complement: 'tables', weight: 0.6 },
  { category: 'beds', complement: 'pillows', weight: 1 },
  { category: 'beds', complement: 'tables', weight: 0.6 },
  { category: 'chairs', complement: 'ottomans', weight: 0.9 },
  { category: 'chairs', complement: 'tables', weight: 0.7 },
  { category: 'tables', complement: 'chairs', weight: 0.7 },
  { category: 'ottomans', complement: 'sofas', weight: 0.6 },
];
