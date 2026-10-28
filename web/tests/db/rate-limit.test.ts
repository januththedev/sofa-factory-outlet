import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { closeDb, type Db, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { countRecent, isRateLimited, phoneKey, visitorKey } from '@/lib/rate-limit';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const NOW = new Date('2026-11-02T10:00:00Z');
const ago = (ms: number) => new Date(NOW.getTime() - ms);

let db: Db;
let counter = 0;

async function addCustomer(phone: string): Promise<number> {
  const [row] = await db.insert(s.customers).values({ name: 'Rate limit test', phone }).returning({ id: s.customers.id });
  return row.id;
}

/** A booking row with an explicit creation time, as the form would have left behind. */
async function addBooking(customerId: number, createdAt: Date, visitorId: string | null) {
  counter += 1;
  await db.insert(s.bookings).values({ reference: `RL-TEST-${counter}`, customerId, visitDate: '2026-11-10', slotLabel: '10:00–12:00', visitorId, createdAt });
}

const PHONE_A = '+94771110001';
const PHONE_B = '+94772220002';

beforeAll(async () => {
  db = await getDb();
  const a = await addCustomer(PHONE_A);
  const b = await addCustomer(PHONE_B);
  // Customer A, browser "v-a": 10 minutes, 50 minutes, 2 hours and 3 days ago.
  for (const age of [10 * MINUTE, 50 * MINUTE, 2 * HOUR, 3 * DAY]) await addBooking(a, ago(age), 'v-a');
  // Customer B on the same browser 20 minutes ago, and once more on its own browser 5 minutes ago.
  await addBooking(b, ago(20 * MINUTE), 'v-a');
  await addBooking(b, ago(5 * MINUTE), 'v-b');
  // A booking exactly one hour old sits on the edge of the window.
  await addBooking(b, ago(HOUR), 'v-edge');
  // Bookings made without a visitor id still count against the phone number.
  await addBooking(b, ago(30 * MINUTE), null);
});

afterAll(async () => {
  await closeDb();
});

describe('countRecent', () => {
  it('counts a browser`s bookings inside the window only', async () => {
    const count = (windowMs: number) => countRecent({ key: visitorKey('v-a'), windowMs, now: NOW });
    expect(await count(5 * MINUTE)).toBe(0);
    expect(await count(HOUR)).toBe(3);
    expect(await count(3 * HOUR)).toBe(4);
    expect(await count(4 * DAY)).toBe(5);
  });

  it('counts a phone number`s bookings inside the window only', async () => {
    const count = (phone: string, windowMs: number) => countRecent({ key: phoneKey(phone), windowMs, now: NOW });
    expect(await count(PHONE_A, HOUR)).toBe(2);
    expect(await count(PHONE_A, 3 * HOUR)).toBe(3);
    expect(await count(PHONE_A, 4 * DAY)).toBe(4);
    // Customer B: 5, 20 and 30 minutes ago (the one at exactly an hour is outside).
    expect(await count(PHONE_B, HOUR)).toBe(3);
    expect(await count(PHONE_B, HOUR + MINUTE)).toBe(4);
  });

  it('keeps a browser and a phone number separate', async () => {
    // v-a was also used by customer B once, which must not count against customer A's phone.
    expect(await countRecent({ key: visitorKey('v-a'), windowMs: HOUR, now: NOW })).toBe(3);
    expect(await countRecent({ key: phoneKey(PHONE_A), windowMs: HOUR, now: NOW })).toBe(2);
    expect(await countRecent({ key: visitorKey('v-b'), windowMs: HOUR, now: NOW })).toBe(1);
  });

  it('excludes a booking exactly as old as the window', async () => {
    expect(await countRecent({ key: visitorKey('v-edge'), windowMs: HOUR, now: NOW })).toBe(0);
    expect(await countRecent({ key: visitorKey('v-edge'), windowMs: HOUR + 1, now: NOW })).toBe(1);
  });

  it('returns 0 for keys nobody has used and copes with colons in an id', async () => {
    expect(await countRecent({ key: visitorKey('nobody'), windowMs: DAY, now: NOW })).toBe(0);
    expect(await countRecent({ key: phoneKey('+94770000000'), windowMs: DAY, now: NOW })).toBe(0);
    await addBooking(await addCustomer('+94775550005'), ago(MINUTE), 'odd:id:1');
    expect(await countRecent({ key: visitorKey('odd:id:1'), windowMs: HOUR, now: NOW })).toBe(1);
  });

  it('refuses a key it does not understand', async () => {
    await expect(countRecent({ key: 'ip:203.0.113.9' as never, windowMs: HOUR, now: NOW })).rejects.toThrow(/unsupported/i);
  });
});

describe('isRateLimited', () => {
  it('limits once the allowance for the window is used up', async () => {
    // v-a made 3 bookings in the last hour.
    const limited = (limit: number) => isRateLimited({ key: visitorKey('v-a'), limit, windowMs: HOUR, now: NOW });
    expect(await limited(4)).toBe(false);
    expect(await limited(3)).toBe(true);
    expect(await limited(2)).toBe(true);
  });

  it('forgets bookings once they leave the window', async () => {
    const check = (windowMs: number) => isRateLimited({ key: phoneKey(PHONE_A), limit: 3, windowMs, now: NOW });
    expect(await check(HOUR)).toBe(false);
    expect(await check(3 * HOUR)).toBe(true);
  });

  it('allows five bookings an hour and refuses the sixth', async () => {
    const customerId = await addCustomer('+94773330003');
    for (let made = 1; made <= 5; made += 1) {
      await addBooking(customerId, ago(made * 10 * MINUTE), 'v-five');
      // After the fifth booking the next attempt would be the sixth.
      expect(await isRateLimited({ key: visitorKey('v-five'), limit: 5, windowMs: HOUR, now: NOW })).toBe(made >= 5);
      expect(await isRateLimited({ key: phoneKey('+94773330003'), limit: 5, windowMs: HOUR, now: NOW })).toBe(made >= 5);
    }
  });

  it('uses the current time when none is given', async () => {
    const customerId = await addCustomer('+94774440004');
    await addBooking(customerId, new Date(), 'v-live');
    expect(await isRateLimited({ key: visitorKey('v-live'), limit: 1, windowMs: HOUR })).toBe(true);
    expect(await isRateLimited({ key: visitorKey('v-live'), limit: 2, windowMs: HOUR })).toBe(false);
  });
});
