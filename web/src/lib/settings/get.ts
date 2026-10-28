import { unstable_cache } from 'next/cache';
import { getDb } from '../db';
import * as s from '../db/schema';
import { DEFAULT_SETTINGS } from './defaults';
import type { SettingsKey, SettingsMap } from './types';

// A stored null is a choice (a closed day, a cleared number) and wins over the default; only a missing key falls back.
function merge<T>(base: T, override: unknown): T {
  if (override === undefined) return base;
  if (override === null) return null as T;
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return override as T;
  if (typeof override !== 'object' || Array.isArray(override)) return override as T;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(override as Record<string, unknown>)) {
    out[key] = key in out ? merge(out[key], value) : value;
  }
  return out as T;
}

async function loadSettings(): Promise<SettingsMap> {
  const db = await getDb();
  const rows = await db.select().from(s.settings);
  const result: SettingsMap = structuredClone(DEFAULT_SETTINGS);
  for (const row of rows) {
    if (row.key in result) {
      const key = row.key as SettingsKey;
      (result as Record<string, unknown>)[key] = merge(result[key], row.value);
    }
  }
  return result;
}

/** All settings with defaults filled in. Cached; the admin settings page revalidates the `settings` tag. */
export const getSettings = unstable_cache(loadSettings, ['settings-v1'], { tags: ['settings'], revalidate: 3600 });

export async function getSetting<K extends SettingsKey>(key: K): Promise<SettingsMap[K]> {
  return (await getSettings())[key];
}

/** Digits-only WhatsApp number for wa.me links, or null. */
export function whatsappDigits(number: string | null | undefined): string | null {
  const digits = (number ?? '').replace(/\D/g, '');
  return digits.length >= 9 ? digits : null;
}

export function whatsappLink(number: string | null | undefined, text?: string): string | null {
  const digits = whatsappDigits(number);
  if (!digits) return null;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}

export function mapsDirectionsUrl(address: { street: string; locality: string; city: string }): string {
  const query = [address.street, address.locality, address.city, 'Sri Lanka'].join(', ');
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(query)}`;
}

export function mapsEmbedUrl(address: { street: string; locality: string; city: string }): string {
  const query = [address.street, address.locality, address.city].join(', ');
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=m&z=15&output=embed&iwloc=near`;
}
