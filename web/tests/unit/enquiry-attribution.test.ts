import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { captureCampaign, readCampaign } from '@/lib/analytics/campaign';
import { collectAttribution } from '@/lib/analytics/attribution';
import {
  clearSubmissionToken,
  submissionToken,
} from '@/lib/security/submission-token';
let values: Map<string, string>;
function route(url: string) {
  vi.stubGlobal('window', { location: new URL(url) });
}
beforeEach(() => {
  values = new Map();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe('enquiry attribution and retry identity', () => {
  it('retains the first campaign and the last campaign after ordinary internal navigation', () => {
    route('https://shop.test/shop/?utm_source=facebook&utm_campaign=first');
    expect(collectAttribution()).toMatchObject({
      source: 'facebook',
      first_campaign: 'first',
      landing: '/shop/',
    });
    route('https://shop.test/product/sofa/');
    expect(collectAttribution()).toMatchObject({
      source: 'facebook',
      campaign: 'first',
      landing: '/shop/',
    });
    route('https://shop.test/shop/?utm_source=instagram&utm_campaign=second');
    expect(collectAttribution()).toMatchObject({
      source: 'instagram',
      first_source: 'facebook',
      campaign: 'second',
      first_campaign: 'first',
    });
    route('https://shop.test/request-quote/');
    expect(collectAttribution()).toMatchObject({
      source: 'instagram',
      first_source: 'facebook',
      landing: '/shop/',
    });
  });
  it('expires old campaign information and fails safely when storage is blocked', () => {
    vi.useFakeTimers();
    route('https://shop.test/shop/?utm_source=facebook');
    collectAttribution();
    vi.advanceTimersByTime(31 * 86400000);
    route('https://shop.test/shop/');
    expect(collectAttribution().source).toBeUndefined();
    vi.stubGlobal('sessionStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
    });
    expect(collectAttribution()).toEqual({});
  });
  it('keeps retries stable across refresh, separates flows and creates a new identity after completion', () => {
    const first = submissionToken('quote');
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(submissionToken('quote')).toBe(first);
    expect(submissionToken('booking')).not.toBe(first);
    clearSubmissionToken('quote');
    expect(submissionToken('quote')).not.toBe(first);
  });
});

it('captures attribution before hydration, bounds cookie fields and retains the original campaign', () => {
  const first = captureCampaign(
    new URL('https://shop.test/shop/?utm_source=facebook&utm_campaign=first'),
    {},
  );
  expect(first).toMatchObject({
    source: 'facebook',
    first_campaign: 'first',
    landing: '/shop/',
  });
  const second = captureCampaign(
    new URL('https://shop.test/product/sofa/?utm_source=instagram'),
    first!,
  );
  expect(second).toMatchObject({
    source: 'instagram',
    first_source: 'facebook',
    landing: '/shop/',
  });
  const safe = readCampaign(
    encodeURIComponent(
      JSON.stringify({ ...second, secret: 'must not persist' }),
    ),
  );
  expect(safe.secret).toBeUndefined();
  vi.stubGlobal('document', {
    cookie: 'sfo-campaign=' + encodeURIComponent(JSON.stringify(first)),
  });
  route('https://shop.test/request-quote/');
  expect(collectAttribution()).toMatchObject({
    source: 'facebook',
    campaign: 'first',
    landing: '/shop/',
  });
});

it('reads both browser-encoded and server-decoded cookie values without damaging literal percent signs', () => {
  const raw = JSON.stringify({ source: 'facebook', campaign: '50% off' });
  expect(readCampaign(raw)).toMatchObject({campaign:'50% off'});
  expect(readCampaign(encodeURIComponent(raw))).toMatchObject({campaign:'50% off'});
});
