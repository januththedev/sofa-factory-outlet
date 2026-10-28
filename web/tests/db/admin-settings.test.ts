import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const requireRole = vi.hoisted(() => vi.fn());
const revalidateSettings = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());

vi.mock('@/lib/auth/session', () => ({ requireRole }));
vi.mock('@/lib/revalidate', () => ({ revalidateSettings }));
vi.mock('next/cache', () => ({ refresh }));

import * as actions from '@/app/admin/(panel)/settings/actions';
import {
  changeStaffRole,
  createStaff,
  generateTempPassword,
  listStaff,
  resetStaffPassword,
  setStaffActive,
} from '@/app/admin/(panel)/settings/staff';
import { readSettings, readSlots, saveSlots, type SlotInput, writeSetting } from '@/lib/admin/settings';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { closeDb, type Db, getDb } from '@/lib/db';
import * as s from '@/lib/db/schema';
import { DEFAULT_SETTINGS } from '@/lib/settings/defaults';
import type { SettingsKey } from '@/lib/settings/types';

let db: Db;

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
};

async function resetSlots() {
  await db.delete(s.bookings);
  await db.delete(s.customers);
  await db.delete(s.bookingSlots);
  await db.insert(s.bookingSlots).values([
    { weekday: 1, start: '10:00', end: '12:00', capacity: 3 },
    { weekday: 1, start: '12:00', end: '14:00', capacity: 3 },
    { weekday: 0, start: '10:00', end: '12:00', capacity: 2 },
  ]);
}

async function resetSettings() {
  for (const key of Object.keys(DEFAULT_SETTINGS) as SettingsKey[]) {
    await writeSetting(db, key, DEFAULT_SETTINGS[key] as never);
  }
}

beforeAll(async () => {
  db = await getDb();
});

beforeEach(async () => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue({ userId: 1, email: 'owner@test.local', name: 'Owner', role: 'owner' });
  await resetSettings();
});

afterAll(async () => {
  await closeDb();
});

describe('readSettings and writeSetting', () => {
  it('returns the defaults for a freshly seeded database', async () => {
    expect(await readSettings(db)).toEqual(DEFAULT_SETTINGS);
  });

  it('replaces a row instead of adding another', async () => {
    await writeSetting(db, 'business', { ...DEFAULT_SETTINGS.business, name: 'Renamed Outlet' });
    await writeSetting(db, 'business', { ...DEFAULT_SETTINGS.business, name: 'Renamed Twice' });
    expect((await readSettings(db)).business.name).toBe('Renamed Twice');
    expect(await db.select().from(s.settings).where(eq(s.settings.key, 'business'))).toHaveLength(1);
  });

  it('fills the gaps of a partly stored row from the defaults', async () => {
    await db.update(s.settings).set({ value: { indexNow: true } }).where(eq(s.settings.key, 'seo'));
    expect((await readSettings(db)).seo).toEqual({ aiCrawlers: 'allow', indexNow: true });
  });

  it('keeps a stored null: a closed day or a cleared number is not put back', async () => {
    const hours = { ...DEFAULT_SETTINGS.hours, days: { ...DEFAULT_SETTINGS.hours.days, wed: null } };
    await writeSetting(db, 'hours', hours);
    await writeSetting(db, 'business', {
      ...DEFAULT_SETTINGS.business,
      whatsapp: { number: null, confirmed: false },
    });
    const settings = await readSettings(db);
    expect(settings.hours.days.wed).toBeNull();
    expect(settings.hours.days.tue).toEqual({ open: '10:00', close: '18:00' });
    expect(settings.business.whatsapp.number).toBeNull();
  });

  it('ignores a row whose value is not an object', async () => {
    await db.update(s.settings).set({ value: [1, 2] }).where(eq(s.settings.key, 'seo'));
    expect((await readSettings(db)).seo).toEqual(DEFAULT_SETTINGS.seo);
  });

  it('fills in a key whose row is missing', async () => {
    await db.delete(s.settings).where(eq(s.settings.key, 'proof'));
    expect((await readSettings(db)).proof).toEqual(DEFAULT_SETTINGS.proof);
  });

  it('does not expose other rows in the table', async () => {
    expect(Object.keys(await readSettings(db)).sort()).toEqual(Object.keys(DEFAULT_SETTINGS).sort());
  });
});

describe('saveSlots', () => {
  const slot = (weekday: number, start: string, end: string, extra: Partial<SlotInput> = {}): SlotInput => ({
    weekday,
    start,
    end,
    capacity: 3,
    active: true,
    ...extra,
  });

  beforeEach(resetSlots);

  async function bookSlot(slotId: number) {
    const [customer] = await db
      .insert(s.customers)
      .values({ name: 'Booked', phone: `+94771${String(slotId).padStart(6, '0')}` })
      .returning({ id: s.customers.id });
    await db.insert(s.bookings).values({
      reference: `SFO-B-S${slotId}`,
      customerId: customer.id,
      visitDate: '2026-06-01',
      slotId,
      slotLabel: '10:00–12:00',
    });
  }

  it('reads the table Monday first', async () => {
    const rows = await readSlots(db);
    expect(rows.map((row) => `${row.weekday}@${row.start}`)).toEqual(['1@10:00', '1@12:00', '0@10:00']);
  });

  it('updates rows in place, keeping their ids', async () => {
    const before = await readSlots(db);
    const result = await saveSlots(
      db,
      before.map((row) => ({ ...row, capacity: 9 })),
    );
    expect(result).toEqual({ added: 0, updated: 3, removed: 0, deactivated: 0 });
    const after = await readSlots(db);
    expect(after.map((row) => row.id).sort()).toEqual(before.map((row) => row.id).sort());
    expect(after.every((row) => row.capacity === 9)).toBe(true);
  });

  it('adds rows that have no id', async () => {
    const before = await readSlots(db);
    const result = await saveSlots(db, [...before, slot(2, '10:00', '11:00')]);
    expect(result).toMatchObject({ added: 1, updated: 3, removed: 0 });
    expect(await readSlots(db)).toHaveLength(4);
  });

  it('treats an id that is not in the table, or repeated, as a new row', async () => {
    const [first] = await readSlots(db);
    const result = await saveSlots(db, [
      first,
      { ...first, start: '15:00', end: '16:00' },
      slot(3, '10:00', '11:00', { id: 99_999 }),
    ]);
    expect(result).toMatchObject({ updated: 1, added: 2, removed: 2 });
    expect(await readSlots(db)).toHaveLength(3);
  });

  it('deletes a removed row that nothing refers to', async () => {
    const rows = await readSlots(db);
    const result = await saveSlots(db, rows.slice(0, 1));
    expect(result).toEqual({ added: 0, updated: 1, removed: 2, deactivated: 0 });
    expect(await readSlots(db)).toHaveLength(1);
  });

  it('switches off, rather than deletes, a removed row that has a booking', async () => {
    const rows = await readSlots(db);
    const booked = rows.find((row) => row.start === '12:00');
    expect(booked).toBeDefined();
    if (!booked) return;
    await bookSlot(booked.id);

    const result = await saveSlots(db, rows.filter((row) => row.id !== booked.id));
    expect(result).toEqual({ added: 0, updated: 2, removed: 0, deactivated: 1 });
    const after = await readSlots(db);
    expect(after.find((row) => row.id === booked.id)).toMatchObject({ active: false });
    const [kept] = await db.select().from(s.bookings);
    expect(kept.slotId).toBe(booked.id);
  });

  it('can clear the table', async () => {
    const result = await saveSlots(db, []);
    expect(result.removed).toBe(3);
    expect(await readSlots(db)).toEqual([]);
  });
});

describe('staff accounts', () => {
  let ownerId: number;
  let staffId: number;
  let secondOwnerId: number;
  let startHash: string;

  async function addUser(name: string, role: 'owner' | 'staff', active = true) {
    const [row] = await db
      .insert(s.adminUsers)
      .values({ name, email: `${name.toLowerCase()}@example.lk`, passwordHash: startHash, role, active })
      .returning({ id: s.adminUsers.id });
    return row.id;
  }

  // Hashing is slow on purpose (bcrypt cost 12), so every test account shares one.
  beforeAll(async () => {
    startHash = await hashPassword('start-pass-1');
  }, 60_000);

  beforeEach(async () => {
    await db.delete(s.adminUsers);
    ownerId = await addUser('Asha', 'owner');
    staffId = await addUser('Bimal', 'staff');
    secondOwnerId = await addUser('Chamari', 'owner', false);
  });

  const stored = async (id: number) => {
    const [row] = await db.select().from(s.adminUsers).where(eq(s.adminUsers.id, id));
    return row;
  };

  describe('generateTempPassword', () => {
    it('is long enough, readable and different each time', () => {
      const seen = new Set<string>();
      for (let i = 0; i < 40; i += 1) {
        const password = generateTempPassword();
        expect(password).toMatch(/^[A-HJ-NP-Za-km-z2-9]{14}$/);
        seen.add(password);
      }
      expect(seen.size).toBe(40);
    });
  });

  describe('createStaff', () => {
    it('makes an account with a temporary password that works, stored only as a hash', async () => {
      const result = await createStaff(db, { name: '  Nimal Perera ', email: ' Nimal@Example.LK ', role: 'staff' });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.tempPassword).toHaveLength(14);

      const user = (await listStaff(db)).find((member) => member.email === 'nimal@example.lk');
      expect(user).toMatchObject({ name: 'Nimal Perera', role: 'staff', active: true, lastLoginAt: null });
      const row = await stored(user?.id ?? 0);
      expect(row.passwordHash).not.toContain(result.tempPassword ?? '');
      expect(await verifyPassword(result.tempPassword ?? '', row.passwordHash)).toBe(true);
      expect(await verifyPassword('wrong-password', row.passwordHash)).toBe(false);
    });

    it('refuses an email that is already used, whatever its case', async () => {
      const result = await createStaff(db, { name: 'Copy', email: 'ASHA@example.lk', role: 'staff' });
      expect(result).toEqual({ ok: false, error: 'An account with that email address already exists.' });
      expect(await listStaff(db)).toHaveLength(3);
    });

    it('can make another owner', async () => {
      const result = await createStaff(db, { name: 'Dilan', email: 'dilan@example.lk', role: 'owner' });
      expect(result.ok).toBe(true);
      expect((await listStaff(db)).find((member) => member.name === 'Dilan')?.role).toBe('owner');
    });
  });

  describe('listStaff', () => {
    it('lists everyone by name, with whether they can sign in', async () => {
      const members = await listStaff(db);
      expect(members.map((member) => [member.name, member.role, member.active])).toEqual([
        ['Asha', 'owner', true],
        ['Bimal', 'staff', true],
        ['Chamari', 'owner', false],
      ]);
      expect(Object.keys(members[0]).sort()).toEqual(['active', 'email', 'id', 'lastLoginAt', 'name', 'role']);
    });
  });

  describe('changeStaffRole', () => {
    it('promotes and demotes', async () => {
      expect((await changeStaffRole(db, staffId, 'owner')).ok).toBe(true);
      expect((await stored(staffId)).role).toBe('owner');
      expect((await changeStaffRole(db, staffId, 'staff')).ok).toBe(true);
      expect((await stored(staffId)).role).toBe('staff');
    });

    it('will not demote the last active owner, even when an inactive owner exists', async () => {
      const result = await changeStaffRole(db, ownerId, 'staff');
      expect(result).toEqual({ ok: false, error: 'There must always be at least one active owner.' });
      expect((await stored(ownerId)).role).toBe('owner');
    });

    it('demotes an owner when another active owner remains', async () => {
      await changeStaffRole(db, staffId, 'owner');
      expect((await changeStaffRole(db, ownerId, 'staff')).ok).toBe(true);
    });

    it('lets an inactive owner be demoted', async () => {
      expect((await changeStaffRole(db, secondOwnerId, 'staff')).ok).toBe(true);
    });

    it('says so when nothing changes, or the account is gone', async () => {
      expect(await changeStaffRole(db, staffId, 'staff')).toMatchObject({ ok: true });
      expect(await changeStaffRole(db, 987_654, 'owner')).toEqual({
        ok: false,
        error: 'That account no longer exists.',
      });
    });
  });

  describe('setStaffActive', () => {
    it('deactivates and reactivates a staff account', async () => {
      expect((await setStaffActive(db, ownerId, staffId, false)).ok).toBe(true);
      expect((await stored(staffId)).active).toBe(false);
      expect((await setStaffActive(db, ownerId, staffId, true)).ok).toBe(true);
      expect((await stored(staffId)).active).toBe(true);
    });

    it('will not let you deactivate yourself', async () => {
      const result = await setStaffActive(db, ownerId, ownerId, false);
      expect(result).toEqual({ ok: false, error: 'You cannot deactivate your own account.' });
      expect((await stored(ownerId)).active).toBe(true);
    });

    it('will not deactivate the last active owner', async () => {
      const result = await setStaffActive(db, staffId, ownerId, false);
      expect(result).toEqual({ ok: false, error: 'There must always be at least one active owner.' });
      expect((await stored(ownerId)).active).toBe(true);
    });

    it('deactivates an owner while another active owner remains', async () => {
      expect((await setStaffActive(db, ownerId, secondOwnerId, true)).ok).toBe(true);
      expect((await setStaffActive(db, secondOwnerId, ownerId, false)).ok).toBe(true);
      expect((await stored(ownerId)).active).toBe(false);
    });

    it('says so when it is already in that state, or the account is gone', async () => {
      expect(await setStaffActive(db, ownerId, staffId, true)).toMatchObject({ ok: true });
      expect(await setStaffActive(db, ownerId, 987_654, false)).toEqual({
        ok: false,
        error: 'That account no longer exists.',
      });
    });
  });

  describe('resetStaffPassword', () => {
    it('sets a new temporary password and retires the old one', async () => {
      const result = await resetStaffPassword(db, staffId);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const row = await stored(staffId);
      expect(await verifyPassword(result.tempPassword ?? '', row.passwordHash)).toBe(true);
      expect(await verifyPassword('start-pass-1', row.passwordHash)).toBe(false);
    });

    it('leaves everyone else alone', async () => {
      await resetStaffPassword(db, staffId);
      expect(await verifyPassword('start-pass-1', (await stored(ownerId)).passwordHash)).toBe(true);
    });

    it('reports a missing account', async () => {
      expect(await resetStaffPassword(db, 987_654)).toEqual({ ok: false, error: 'That account no longer exists.' });
    });
  });

  describe('staffAction', () => {
    beforeEach(() => {
      requireRole.mockResolvedValue({ userId: ownerId, email: 'asha@example.lk', name: 'Asha', role: 'owner' });
    });

    it('creates an account and returns its password once', async () => {
      const state = await actions.staffAction(
        null,
        form({ intent: 'create', name: 'Esha', email: 'esha@example.lk', role: 'staff' }),
      );
      expect(state).toMatchObject({ ok: true, intent: 'create' });
      expect(state?.tempPassword).toHaveLength(14);
      expect(refresh).toHaveBeenCalled();
      const row = (await listStaff(db)).find((member) => member.email === 'esha@example.lk');
      expect(row).toBeDefined();
    });

    it('does not include a password in any other answer', async () => {
      const state = await actions.staffAction(null, form({ intent: 'role', id: String(staffId), role: 'owner' }));
      expect(state).toMatchObject({ ok: true, intent: 'role' });
      expect(state?.tempPassword).toBeUndefined();
    });

    it('refuses to let the signed-in owner deactivate themselves', async () => {
      const state = await actions.staffAction(null, form({ intent: 'active', id: String(ownerId), active: 'false' }));
      expect(state).toMatchObject({ ok: false, message: 'You cannot deactivate your own account.' });
      expect(refresh).not.toHaveBeenCalled();
      expect((await stored(ownerId)).active).toBe(true);
    });

    it('refuses to demote the last owner', async () => {
      const state = await actions.staffAction(null, form({ intent: 'role', id: String(ownerId), role: 'staff' }));
      expect(state).toMatchObject({ ok: false, message: 'There must always be at least one active owner.' });
    });

    it('resets a password', async () => {
      const state = await actions.staffAction(null, form({ intent: 'reset', id: String(staffId) }));
      expect(state).toMatchObject({ ok: true, intent: 'reset' });
      expect(state?.tempPassword).toHaveLength(14);
    });

    it('rejects bad input without touching anything', async () => {
      const state = await actions.staffAction(
        null,
        form({ intent: 'create', name: 'Bad', email: 'not-an-email', role: 'staff' }),
      );
      expect(state?.ok).toBe(false);
      expect(state?.errors.email).toBeDefined();
      expect(await listStaff(db)).toHaveLength(3);
    });
  });
});

describe('settings actions', () => {
  beforeEach(resetSlots);

  const businessFields = {
    name: 'Sofa Factory Outlet',
    tagline: 'Made in Colombo',
    'address.street': '12 New Road',
    'address.locality': 'Dehiwala',
    'address.city': 'Colombo',
    'address.postalCode': '10350',
    'address.confirmed': 'on',
    'phone.number': '0112 345 678',
    'phone.confirmed': 'on',
    'whatsapp.number': '077 671 1711',
    'email.address': 'hello@example.lk',
    'social.facebook': 'https://facebook.com/sofafactory',
    'social.instagram': '',
    'social.tiktok': '',
    'social.youtube': '',
    'map.placeUrl': '',
    'map.googleReviewUrl': 'https://g.page/r/example',
    priceRange: 'LKR',
  };

  describe('saveBusinessAction', () => {
    it('saves, marks what was confirmed and refreshes the site cache', async () => {
      const state = await actions.saveBusinessAction(null, form(businessFields));
      expect(state).toMatchObject({ ok: true, errors: {} });
      expect(revalidateSettings).toHaveBeenCalledTimes(1);
      expect(refresh).toHaveBeenCalledTimes(1);

      const { business } = await readSettings(db);
      expect(business.address).toMatchObject({
        street: '12 New Road',
        postalCode: '10350',
        confirmed: true,
        country: 'LK',
      });
      expect(business.phone).toEqual({ number: '+94112345678', confirmed: true });
      expect(business.whatsapp).toEqual({ number: '+94776711711', confirmed: false });
      expect(business.email).toEqual({ address: 'hello@example.lk', confirmed: false });
      expect(business.social.facebook).toBe('https://facebook.com/sofafactory');
      expect(business.map.googleReviewUrl).toBe('https://g.page/r/example');
    });

    it('saves nothing and says which field is wrong', async () => {
      const state = await actions.saveBusinessAction(null, form({ ...businessFields, 'phone.number': 'abc' }));
      expect(state?.ok).toBe(false);
      expect(state?.errors['phone.number']).toBeDefined();
      expect(revalidateSettings).not.toHaveBeenCalled();
      expect((await readSettings(db)).business).toEqual(DEFAULT_SETTINGS.business);
    });
  });

  describe('saveHoursAction', () => {
    const hoursFields = (slots: SlotInput[]) => ({
      'hours.days.mon.open': '09:00',
      'hours.days.mon.close': '17:00',
      'hours.days.tue.open': '09:00',
      'hours.days.tue.close': '17:00',
      'hours.days.wed.closed': 'on',
      'hours.days.thu.open': '09:00',
      'hours.days.thu.close': '17:00',
      'hours.days.fri.open': '09:00',
      'hours.days.fri.close': '17:00',
      'hours.days.sat.open': '09:00',
      'hours.days.sat.close': '13:00',
      'hours.days.sun.closed': 'on',
      'hours.closedDates': '2026-12-25',
      'hours.note': 'Closed on poya days',
      'hours.confirmed': 'on',
      'booking.leadDays': '2',
      'booking.horizonDays': '30',
      'booking.confirmed': 'on',
      slots: JSON.stringify(slots),
    });

    it('saves hours, booking rules and the slot table together', async () => {
      const existing = await readSlots(db);
      const keep = existing[0];
      const saturday = { weekday: 6, start: '10:00', end: '12:00', capacity: 2, active: true };
      const state = await actions.saveHoursAction(
        null,
        form(hoursFields([{ ...keep, capacity: 8 }, saturday])),
      );
      expect(state).toMatchObject({ ok: true });

      const settings = await readSettings(db);
      expect(settings.hours).toMatchObject({
        confirmed: true,
        closedDates: ['2026-12-25'],
        note: 'Closed on poya days',
        days: { mon: { open: '09:00', close: '17:00' }, wed: null, sun: null },
      });
      expect(settings.booking).toEqual({ leadDays: 2, horizonDays: 30, confirmed: true });

      const slots = await readSlots(db);
      expect(slots).toHaveLength(2);
      expect(slots.find((row) => row.id === keep.id)?.capacity).toBe(8);
      expect(slots.find((row) => row.weekday === 6)).toMatchObject({ start: '10:00', capacity: 2 });
    });

    it('saves nothing at all when a slot overlaps another', async () => {
      const before = await readSlots(db);
      const state = await actions.saveHoursAction(
        null,
        form(
          hoursFields([
            { weekday: 1, start: '10:00', end: '12:00', capacity: 3, active: true },
            { weekday: 1, start: '11:00', end: '13:00', capacity: 3, active: true },
          ]),
        ),
      );
      expect(state?.ok).toBe(false);
      expect(state?.errors['slots.1']).toContain('overlaps');
      expect((await readSettings(db)).hours).toEqual(DEFAULT_SETTINGS.hours);
      expect(await readSlots(db)).toEqual(before);
      expect(revalidateSettings).not.toHaveBeenCalled();
    });

    it('says when a removed slot was kept because it has bookings', async () => {
      const [first] = await readSlots(db);
      const [customer] = await db
        .insert(s.customers)
        .values({ name: 'Holds a slot', phone: '+94771999888' })
        .returning({ id: s.customers.id });
      await db.insert(s.bookings).values({
        reference: 'SFO-B-HOLD',
        customerId: customer.id,
        visitDate: '2026-06-02',
        slotId: first.id,
        slotLabel: 'x',
      });
      const state = await actions.saveHoursAction(
        null,
        form(hoursFields([{ weekday: 2, start: '10:00', end: '11:00', capacity: 1, active: true }])),
      );
      expect(state?.ok).toBe(true);
      expect(state?.message).toContain('switched off instead of deleted');
      expect((await readSlots(db)).find((row) => row.id === first.id)?.active).toBe(false);
      await db.delete(s.bookings).where(eq(s.bookings.reference, 'SFO-B-HOLD'));
      await db.delete(s.customers).where(eq(s.customers.id, customer.id));
    });
  });

  describe('saveInvoiceAction', () => {
    it('stores the percentage as basis points and keeps untouched fields', async () => {
      const state = await actions.saveInvoiceAction(
        null,
        form({
          prefix: 'inv',
          quotationPrefix: 'quo',
          taxEnabled: 'on',
          taxLabel: 'VAT',
          taxRatePercent: '7.5',
          vatNumber: '123456789-7000',
          'bank.bank': 'Example Bank',
          'bank.branch': 'Dehiwala',
          'bank.accountName': 'Sofa Factory Outlet',
          'bank.accountNumber': '000123456',
          terms: 'Balance on delivery.',
          warranty: 'Ten years structural.',
          confirmed: 'on',
        }),
      );
      expect(state).toMatchObject({ ok: true });
      const { invoice } = await readSettings(db);
      expect(invoice).toEqual({
        prefix: 'INV',
        quotationPrefix: 'QUO',
        taxEnabled: true,
        taxLabel: 'VAT',
        taxRateBp: 750,
        vatNumber: '123456789-7000',
        bank: {
          bank: 'Example Bank',
          branch: 'Dehiwala',
          accountName: 'Sofa Factory Outlet',
          accountNumber: '000123456',
        },
        terms: 'Balance on delivery.',
        warranty: 'Ten years structural.',
        confirmed: true,
      });
    });

    it('rejects a rate over 100 per cent', async () => {
      const state = await actions.saveInvoiceAction(
        null,
        form({ prefix: 'A', quotationPrefix: 'B', taxLabel: 'VAT', taxRatePercent: '180', terms: 't', warranty: 'w' }),
      );
      expect(state?.ok).toBe(false);
      expect(state?.errors.taxRatePercent).toBeDefined();
    });
  });

  describe('saveDeliveryAction and saveProofAction', () => {
    it('saves the delivery terms', async () => {
      const state = await actions.saveDeliveryAction(
        null,
        form({
          'delivery.colomboDays': '2–3 days',
          'delivery.islandwideDays': '1–2 weeks',
          'delivery.colomboCharge': 'Free',
          'delivery.islandwideCharge': 'By district',
          'delivery.warranty': '5 years',
          'delivery.confirmed': 'on',
        }),
      );
      expect(state?.ok).toBe(true);
      expect((await readSettings(db)).delivery).toEqual({
        colomboDays: '2–3 days',
        islandwideDays: '1–2 weeks',
        colomboCharge: 'Free',
        islandwideCharge: 'By district',
        warranty: '5 years',
        confirmed: true,
      });
    });

    it('rejects a delivery form with an empty field', async () => {
      const state = await actions.saveDeliveryAction(null, form({ 'delivery.colomboDays': '' }));
      expect(state?.ok).toBe(false);
      expect(state?.errors['delivery.colomboDays']).toBeDefined();
    });

    it('saves proof numbers, with blanks as unknown', async () => {
      const state = await actions.saveProofAction(
        null,
        form({ 'proof.years': '15', 'proof.homes': '', 'proof.districts': '12', 'proof.confirmed': 'on' }),
      );
      expect(state?.ok).toBe(true);
      expect((await readSettings(db)).proof).toEqual({ years: 15, homes: null, districts: 12, confirmed: true });
    });
  });

  describe('saveChatSeoAction', () => {
    const chatFields = {
      'chat.dailyModelBudget': '30',
      'chat.bufferCalls': '4',
      'chat.perSessionModelAnswers': '2',
      'chat.messagesPer10Min': '15',
      'chat.models': 'a/b:free, c/d:free',
      'chat.temperature': '0.4',
      'chat.maxTokens': '300',
      'chat.timeoutMs': '12000',
      'seo.aiCrawlers': 'block',
      'seo.indexNow': 'on',
    };

    it('saves both rows and keeps the embeddings the knowledge page set', async () => {
      await writeSetting(db, 'chat', {
        ...DEFAULT_SETTINGS.chat,
        embeddings: { enabled: true, model: 'some/embed', dim: 768 },
      });
      const state = await actions.saveChatSeoAction(null, form(chatFields));
      expect(state?.ok).toBe(true);
      const { chat, seo } = await readSettings(db);
      expect(chat).toMatchObject({
        dailyModelBudget: 30,
        models: ['a/b:free', 'c/d:free'],
        temperature: 0.4,
        embeddings: { enabled: true, model: 'some/embed', dim: 768 },
      });
      expect(seo).toEqual({ aiCrawlers: 'block', indexNow: true });
    });

    it('saves neither row when one field is wrong', async () => {
      const state = await actions.saveChatSeoAction(null, form({ ...chatFields, 'chat.temperature': '9' }));
      expect(state?.ok).toBe(false);
      expect(state?.errors['chat.temperature']).toBeDefined();
      const { chat, seo } = await readSettings(db);
      expect(chat).toEqual(DEFAULT_SETTINGS.chat);
      expect(seo).toEqual(DEFAULT_SETTINGS.seo);
    });
  });

  describe('owner-only', () => {
    const calls: Array<[string, () => Promise<unknown>]> = [
      ['saveBusinessAction', () => actions.saveBusinessAction(null, form(businessFields))],
      ['saveHoursAction', () => actions.saveHoursAction(null, form({ slots: '[]' }))],
      ['saveInvoiceAction', () => actions.saveInvoiceAction(null, form({}))],
      ['saveDeliveryAction', () => actions.saveDeliveryAction(null, form({}))],
      ['saveProofAction', () => actions.saveProofAction(null, form({}))],
      ['saveChatSeoAction', () => actions.saveChatSeoAction(null, form({}))],
      ['staffAction', () => actions.staffAction(null, form({ intent: 'reset', id: '1' }))],
    ];

    it.each(calls)('%s asks for the owner role before doing anything', async (_name, call) => {
      requireRole.mockRejectedValueOnce(new Error('NEXT_REDIRECT'));
      await expect(call()).rejects.toThrow('NEXT_REDIRECT');
      expect(requireRole).toHaveBeenCalledWith('owner');
      expect(revalidateSettings).not.toHaveBeenCalled();
      expect(await readSettings(db)).toEqual(DEFAULT_SETTINGS);
    });

    it('is also what a successful save asked for', async () => {
      await actions.saveBusinessAction(null, form(businessFields));
      expect(requireRole).toHaveBeenCalledWith('owner');
    });
  });
});
