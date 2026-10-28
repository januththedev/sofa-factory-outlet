import { asc, eq, inArray } from 'drizzle-orm';
import type { DbOrTx } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { DEFAULT_SETTINGS } from '@/lib/settings/defaults';
import type { SettingsKey, SettingsMap } from '@/lib/settings/types';

// Reading and writing the `settings` and `booking_slots` tables for the admin
// Settings page, plus the small pure rules its forms share. The public site
// reads settings through a cached wrapper (src/lib/settings/get.ts); the admin
// reads the table directly so a page never shows what it has just replaced.

/**
 * Stored values on top of the defaults, key by key. A stored null is a real answer
 * (a closed day, a cleared number) and replaces the default; only a missing key
 * falls back. (The public cache in src/lib/settings/get.ts treats null as "not set".)
 */
function merge<T>(base: T, override: unknown): T {
  if (override === undefined) return base;
  const plain = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
  if (!plain(base) || !plain(override)) return override as T;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = key in out ? merge(out[key], value) : value;
  }
  return out as T;
}

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as SettingsKey[];

/** Every settings key with the defaults filled in, straight from the database. */
export async function readSettings(db: DbOrTx): Promise<SettingsMap> {
  const rows = await db.select().from(s.settings).where(inArray(s.settings.key, SETTING_KEYS));
  const result: SettingsMap = structuredClone(DEFAULT_SETTINGS);
  for (const row of rows) {
    const key = row.key as SettingsKey;
    if (typeof row.value === 'object' && row.value !== null && !Array.isArray(row.value)) {
      (result as Record<string, unknown>)[key] = merge(result[key], row.value);
    }
  }
  return result;
}

/** Replaces one settings row. The caller passes the whole value, merged with what was there. */
export async function writeSetting<K extends SettingsKey>(db: DbOrTx, key: K, value: SettingsMap[K]): Promise<void> {
  const now = new Date();
  await db
    .insert(s.settings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: s.settings.key, set: { value, updatedAt: now } });
}

// ---------------------------------------------------------------------------
// Tax rate: the form shows a percentage, the database stores basis points.

export const MAX_TAX_RATE_BP = 10_000;

export const percentToBp = (percent: number): number => Math.round(percent * 100);

export const bpToPercent = (bp: number): number => bp / 100;

/** "18" or "7.5" to basis points; null when empty, negative, over 100 or with more than two decimals. */
export function parsePercentToBp(text: string): number | null {
  const trimmed = text.trim().replace(/%$/, '').trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(trimmed)) return null;
  const bp = percentToBp(Number(trimmed));
  return bp <= MAX_TAX_RATE_BP ? bp : null;
}

// ---------------------------------------------------------------------------
// Visit slots

export type SlotInput = { id?: number; weekday: number; start: string; end: string; capacity: number; active: boolean };
export type SlotProblem = { index: number; message: string };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const isClockTime = (value: string): boolean => TIME.test(value);
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const MAX_SLOT_CAPACITY = 50;

/**
 * Per-row checks first (weekday, HH:MM times, end after start, capacity 1 to 50),
 * then overlaps between active slots on the same weekday. Slots that touch
 * (one ends when the next starts) are fine; inactive slots never conflict.
 */
export function validateSlots(slots: readonly SlotInput[]): SlotProblem[] {
  const problems: SlotProblem[] = [];
  const sound = new Set<number>();
  slots.forEach((slot, index) => {
    const day = WEEKDAY_NAMES[slot.weekday] ?? 'that day';
    if (!Number.isInteger(slot.weekday) || slot.weekday < 0 || slot.weekday > 6) {
      problems.push({ index, message: 'Choose a weekday.' });
    } else if (!isClockTime(slot.start) || !isClockTime(slot.end)) {
      problems.push({ index, message: `${day}: use times like 10:00.` });
    } else if (slot.end <= slot.start) {
      problems.push({ index, message: `${day} ${slot.start}: the end time must be after the start time.` });
    } else if (!Number.isInteger(slot.capacity) || slot.capacity < 1 || slot.capacity > MAX_SLOT_CAPACITY) {
      problems.push({
        index,
        message: `${day} ${slot.start}: capacity must be a whole number from 1 to ${MAX_SLOT_CAPACITY}.`,
      });
    } else {
      sound.add(index);
    }
  });

  const active = [...sound].filter((index) => slots[index].active);
  for (let a = 0; a < active.length; a += 1) {
    for (let b = a + 1; b < active.length; b += 1) {
      const first = slots[active[a]];
      const second = slots[active[b]];
      if (first.weekday !== second.weekday) continue;
      if (first.start < second.end && second.start < first.end) {
        const day = WEEKDAY_NAMES[first.weekday];
        problems.push({
          index: active[b],
          message: `${day}: ${second.start}–${second.end} overlaps ${first.start}–${first.end}.`,
        });
      }
    }
  }
  return problems.sort((x, y) => x.index - y.index);
}

/** Monday first, then by start time: the order people read a weekly timetable in. */
export const sortSlots = <T extends Pick<SlotInput, 'weekday' | 'start'>>(slots: readonly T[]): T[] =>
  [...slots].sort((x, y) => ((x.weekday + 6) % 7) - ((y.weekday + 6) % 7) || x.start.localeCompare(y.start));

export async function readSlots(db: DbOrTx): Promise<Required<SlotInput>[]> {
  const rows = await db
    .select()
    .from(s.bookingSlots)
    .orderBy(asc(s.bookingSlots.weekday), asc(s.bookingSlots.start));
  return sortSlots(rows);
}

export type SaveSlotsResult = { added: number; updated: number; removed: number; deactivated: number };

/**
 * Makes the table match `slots`. Rows with an id are updated in place so bookings
 * keep pointing at them; rows without one are added. A row left out of the list is
 * deleted, unless a booking still points at it: then it is only switched off, so
 * that booking keeps its slot. Callers validate with validateSlots first and run
 * this inside a transaction together with the settings it belongs to.
 */
export async function saveSlots(db: DbOrTx, slots: readonly SlotInput[]): Promise<SaveSlotsResult> {
  const result: SaveSlotsResult = { added: 0, updated: 0, removed: 0, deactivated: 0 };
  const existing = await db.select({ id: s.bookingSlots.id }).from(s.bookingSlots);
  const known = new Set(existing.map((row) => row.id));
  const keep = new Set<number>();

  for (const slot of slots) {
    const values = {
      weekday: slot.weekday,
      start: slot.start,
      end: slot.end,
      capacity: slot.capacity,
      active: slot.active,
    };
    if (slot.id !== undefined && known.has(slot.id) && !keep.has(slot.id)) {
      await db.update(s.bookingSlots).set(values).where(eq(s.bookingSlots.id, slot.id));
      keep.add(slot.id);
      result.updated += 1;
    } else {
      const [row] = await db.insert(s.bookingSlots).values(values).returning({ id: s.bookingSlots.id });
      keep.add(row.id);
      result.added += 1;
    }
  }

  const dropped = [...known].filter((id) => !keep.has(id));
  if (dropped.length === 0) return result;
  const used = await db
    .select({ slotId: s.bookings.slotId })
    .from(s.bookings)
    .where(inArray(s.bookings.slotId, dropped));
  const inUse = [...new Set(used.map((row) => row.slotId).filter((id): id is number => id !== null))];
  const unused = dropped.filter((id) => !inUse.includes(id));
  if (unused.length > 0) await db.delete(s.bookingSlots).where(inArray(s.bookingSlots.id, unused));
  if (inUse.length > 0) {
    await db.update(s.bookingSlots).set({ active: false }).where(inArray(s.bookingSlots.id, inUse));
  }
  result.removed = unused.length;
  result.deactivated = inUse.length;
  return result;
}

// ---------------------------------------------------------------------------
// Small parsers shared by the forms

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** One YYYY-MM-DD per line (commas work too): sorted, without repeats. `invalid` lists what was not a real date. */
export function parseClosedDates(text: string): { dates: string[]; invalid: string[] } {
  const parts = text
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const invalid = parts.filter((part) => !isRealDate(part));
  const dates = [...new Set(parts.filter(isRealDate))].sort();
  return { dates, invalid };
}

const MODEL_ID = /^[A-Za-z0-9][\w.\-:/]*$/;

/** "a/b, c/d:free" to ['a/b', 'c/d:free']; empty means "use the default list" (null). `invalid` lists bad ids. */
export function parseModelList(text: string): { models: string[] | null; invalid: string[] } {
  const parts = text
    .split(/[\n,]+/)
    .map((part) => part.trim())
    .filter(Boolean);
  const invalid = parts.filter((part) => !MODEL_ID.test(part));
  const models = [...new Set(parts.filter((part) => MODEL_ID.test(part)))];
  return { models: models.length > 0 ? models : null, invalid };
}
