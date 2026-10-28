import { afterAll, describe, expect, it } from 'vitest';
import { writeSetting } from '@/lib/admin/settings';
import { closeDb, getDb } from '@/lib/db';
import { DEFAULT_SETTINGS } from '@/lib/settings/defaults';
import { getSettings } from '@/lib/settings/get';

afterAll(async () => {
  await closeDb();
});

describe('getSettings with stored nulls (what the public site reads)', () => {
  it('keeps a closed day closed instead of putting the default hours back', async () => {
    const db = await getDb();
    const days = { ...DEFAULT_SETTINGS.hours.days, wed: null };
    await writeSetting(db, 'hours', { ...DEFAULT_SETTINGS.hours, days });
    const { hours } = await getSettings();
    expect(hours.days.wed).toBeNull();
    expect(hours.days.tue).toEqual(DEFAULT_SETTINGS.hours.days.tue);
  });

  it('keeps a cleared WhatsApp number cleared', async () => {
    const db = await getDb();
    const business = { ...DEFAULT_SETTINGS.business, whatsapp: { number: null, confirmed: false } };
    await writeSetting(db, 'business', business);
    expect((await getSettings()).business.whatsapp.number).toBeNull();
  });

  it('still fills in a key that is missing from the stored value', async () => {
    const db = await getDb();
    await writeSetting(db, 'chat', {} as typeof DEFAULT_SETTINGS.chat);
    expect((await getSettings()).chat).toEqual(DEFAULT_SETTINGS.chat);
  });
});
