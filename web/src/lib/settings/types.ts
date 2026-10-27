// Typed shapes of the rows in the `settings` table. Values the client still
// has to confirm carry `confirmed: false`; the admin highlights them and the
// public site leaves unconfirmed facts out of structured data.

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type OpeningHours = { open: string; close: string } | null;

export type BusinessSettings = {
  name: string;
  tagline: string;
  address: { street: string; locality: string; city: string; postalCode: string | null; country: 'LK'; confirmed: boolean };
  phone: { number: string | null; confirmed: boolean };
  whatsapp: { number: string | null; confirmed: boolean };
  email: { address: string | null; confirmed: boolean };
  social: { facebook: string | null; instagram: string | null; tiktok: string | null; youtube: string | null };
  map: { lat: number | null; lng: number | null; placeUrl: string | null; googleReviewUrl: string | null; confirmed: boolean };
  priceRange: string;
};

export type HoursSettings = {
  confirmed: boolean;
  timezone: 'Asia/Colombo';
  days: Record<DayKey, OpeningHours>;
  closedDates: string[];
  note: string | null;
};

export type BookingSettings = { leadDays: number; horizonDays: number; confirmed: boolean };

export type InvoiceSettings = {
  prefix: string;
  quotationPrefix: string;
  taxEnabled: boolean;
  taxLabel: string;
  taxRateBp: number;
  vatNumber: string | null;
  bank: { bank: string | null; branch: string | null; accountName: string | null; accountNumber: string | null };
  terms: string;
  warranty: string;
  confirmed: boolean;
};

export type ChatSettings = {
  dailyModelBudget: number;
  bufferCalls: number;
  perSessionModelAnswers: number;
  messagesPer10Min: number;
  models: string[] | null;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  embeddings: { enabled: boolean; model: string | null; dim: number | null };
};

export type SeoSettings = { aiCrawlers: 'allow' | 'block'; indexNow: boolean };

export type ProofSettings = { years: number | null; homes: number | null; districts: number | null; confirmed: boolean };

export type DeliverySettings = {
  confirmed: boolean;
  colomboDays: string;
  islandwideDays: string;
  colomboCharge: string;
  islandwideCharge: string;
  warranty: string;
};

export type SettingsMap = {
  business: BusinessSettings;
  hours: HoursSettings;
  booking: BookingSettings;
  invoice: InvoiceSettings;
  chat: ChatSettings;
  seo: SeoSettings;
  proof: ProofSettings;
  delivery: DeliverySettings;
};

export type SettingsKey = keyof SettingsMap;
