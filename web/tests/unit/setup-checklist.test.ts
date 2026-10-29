import { describe, expect, it } from 'vitest';
import {
  buildSetupChecklist,
  openSetupItems,
  type SetupInput,
  type SetupItemId,
} from '@/lib/admin/setup-checklist';
import { DEFAULT_SETTINGS } from '@/lib/settings/defaults';

/** Everything confirmed and fixed: the checklist is empty. */
function finished(): SetupInput {
  const settings = structuredClone(DEFAULT_SETTINGS);
  settings.business.address.confirmed = true;
  settings.business.phone = { number: '+94112345678', confirmed: true };
  settings.business.whatsapp.confirmed = true;
  settings.business.email = { address: 'hello@example.lk', confirmed: true };
  settings.business.social.facebook = 'https://facebook.com/sofafactory';
  settings.business.map.googleReviewUrl = 'https://g.page/r/example';
  settings.hours.confirmed = true;
  settings.booking.confirmed = true;
  settings.delivery.confirmed = true;
  settings.invoice.confirmed = true;
  settings.proof.confirmed = true;
  return {
    settings,
    counts: { publishedWithoutPrice: 0, flaggedPhotos: 0, productsNeedingReview: 0, approvedReviews: 4 },
    services: { searchConsole: true, openRouter: true, resend: true },
  };
}

const openIds = (input: SetupInput): SetupItemId[] => openSetupItems(buildSetupChecklist(input)).map((item) => item.id);

describe('buildSetupChecklist', () => {
  it('has nothing left when everything is confirmed and fixed', () => {
    const checklist = buildSetupChecklist(finished());
    expect(checklist.remaining).toBe(0);
    expect(checklist.done).toBe(checklist.total);
    expect(openSetupItems(checklist)).toEqual([]);
  });

  it('lists every placeholder the seed data starts with', () => {
    const input = finished();
    input.settings = structuredClone(DEFAULT_SETTINGS);
    input.counts = { publishedWithoutPrice: 15, flaggedPhotos: 22, productsNeedingReview: 15, approvedReviews: 0 };
    input.services = { searchConsole: false, openRouter: false, resend: false };
    const checklist = buildSetupChecklist(input);
    expect(checklist.remaining).toBe(checklist.total);
    expect(openIds(input)).toEqual([
      'address',
      'phone',
      'whatsapp',
      'email',
      'social',
      'google-review',
      'hours',
      'visit-slots',
      'delivery',
      'invoice',
      'proof',
      'prices',
      'photos',
      'product-review',
      'reviews',
      'openrouter',
    ]);
  });

  it('gives every item a unique id and an admin link to fix it', () => {
    const { items } = buildSetupChecklist(finished());
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    for (const item of items) {
      expect(item.href.startsWith('/admin/')).toBe(true);
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  // One row per item: how to fix it, starting from the finished state broken in that one place.
  const cases: Array<[SetupItemId, (input: SetupInput) => void, (input: SetupInput) => void]> = [
    [
      'address',
      (i) => void (i.settings.business.address.confirmed = false),
      (i) => void (i.settings.business.address.confirmed = true),
    ],
    [
      'hours',
      (i) => void (i.settings.hours.confirmed = false),
      (i) => void (i.settings.hours.confirmed = true),
    ],
    [
      'visit-slots',
      (i) => void (i.settings.booking.confirmed = false),
      (i) => void (i.settings.booking.confirmed = true),
    ],
    [
      'delivery',
      (i) => void (i.settings.delivery.confirmed = false),
      (i) => void (i.settings.delivery.confirmed = true),
    ],
    [
      'invoice',
      (i) => void (i.settings.invoice.confirmed = false),
      (i) => void (i.settings.invoice.confirmed = true),
    ],
    [
      'proof',
      (i) => void (i.settings.proof.confirmed = false),
      (i) => void (i.settings.proof.confirmed = true),
    ],
    [
      'google-review',
      (i) => void (i.settings.business.map.googleReviewUrl = null),
      (i) => void (i.settings.business.map.googleReviewUrl = 'https://g.page/r/x'),
    ],
    [
      'prices',
      (i) => void (i.counts.publishedWithoutPrice = 3),
      (i) => void (i.counts.publishedWithoutPrice = 0),
    ],
    ['photos', (i) => void (i.counts.flaggedPhotos = 7), (i) => void (i.counts.flaggedPhotos = 0)],
    [
      'product-review',
      (i) => void (i.counts.productsNeedingReview = 2),
      (i) => void (i.counts.productsNeedingReview = 0),
    ],
    ['reviews', (i) => void (i.counts.approvedReviews = 0), (i) => void (i.counts.approvedReviews = 1)],
    ['openrouter', (i) => void (i.services.openRouter = false), (i) => void (i.services.openRouter = true)],
  ];

  it.each(cases)('%s appears when broken and clears when fixed', (id, breakIt, fixIt) => {
    const input = finished();
    breakIt(input);
    expect(openIds(input)).toEqual([id]);
    fixIt(input);
    expect(openIds(input)).toEqual([]);
  });

  describe('contact details need both a value and the confirmation', () => {
    it.each(['phone', 'whatsapp', 'email'] as const)('%s is open when confirmed but empty', (id) => {
      const input = finished();
      if (id === 'phone') input.settings.business.phone = { number: null, confirmed: true };
      if (id === 'whatsapp') input.settings.business.whatsapp = { number: null, confirmed: true };
      if (id === 'email') input.settings.business.email = { address: null, confirmed: true };
      expect(openIds(input)).toEqual([id]);
    });

    it.each(['phone', 'whatsapp', 'email'] as const)('%s is open when filled in but not confirmed', (id) => {
      const input = finished();
      if (id === 'phone') input.settings.business.phone.confirmed = false;
      if (id === 'whatsapp') input.settings.business.whatsapp.confirmed = false;
      if (id === 'email') input.settings.business.email.confirmed = false;
      expect(openIds(input)).toEqual([id]);
    });

    it('treats a blank string as empty', () => {
      const input = finished();
      input.settings.business.phone = { number: '   ', confirmed: true };
      expect(openIds(input)).toEqual(['phone']);
    });
  });

  describe('social links', () => {
    it('is open while all four are empty', () => {
      const input = finished();
      input.settings.business.social = { facebook: null, instagram: null, tiktok: null, youtube: null };
      expect(openIds(input)).toEqual(['social']);
    });

    it.each(['facebook', 'instagram', 'tiktok', 'youtube'] as const)('clears with only %s set', (network) => {
      const input = finished();
      input.settings.business.social = { facebook: null, instagram: null, tiktok: null, youtube: null };
      input.settings.business.social[network] = 'https://example.com/page';
      expect(openIds(input)).toEqual([]);
    });
  });

  describe('wording', () => {
    const detail = (input: SetupInput, id: SetupItemId) =>
      buildSetupChecklist(input).items.find((item) => item.id === id)?.detail ?? '';

    it('counts products and photos, singular and plural', () => {
      const input = finished();
      input.counts.publishedWithoutPrice = 1;
      input.counts.flaggedPhotos = 1;
      expect(detail(input, 'prices')).toContain('1 published product has');
      expect(detail(input, 'photos')).toContain('1 photo is');
      input.counts.publishedWithoutPrice = 12;
      input.counts.flaggedPhotos = 22;
      expect(detail(input, 'prices')).toContain('12 published products have');
      expect(detail(input, 'photos')).toContain('22 photos are');
    });

    it('says whether a phone number is missing or only unconfirmed', () => {
      const input = finished();
      input.settings.business.phone = { number: null, confirmed: false };
      expect(detail(input, 'phone')).toContain('No phone number');
      input.settings.business.phone = { number: '+94112345678', confirmed: false };
      expect(detail(input, 'phone')).toContain('Confirmed by the client');
    });
  });

  it('does not mutate its input', () => {
    const input = finished();
    const copy = structuredClone(input);
    buildSetupChecklist(input);
    expect(input).toEqual(copy);
  });
});
