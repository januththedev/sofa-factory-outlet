import { describe, expect, it } from 'vitest';
import { referrerHost, sourceBucket } from '@/lib/analytics/server';
import { classifyUserAgent, isBotUserAgent } from '@/lib/analytics/ua';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD =
  'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const ANDROID_TABLET =
  'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const DESKTOP_FIREFOX =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0';
const DESKTOP_SAFARI =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/17.5 Safari/605.1.15';
const GOOGLEBOT = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

describe('classifyUserAgent', () => {
  it('recognises an iPhone as a mobile Safari browser on iOS', () => {
    expect(classifyUserAgent(IPHONE)).toEqual({ device: 'mobile', browser: 'Safari', os: 'iOS', bot: false });
  });

  it('recognises Android Chrome as mobile Chrome on Android', () => {
    expect(classifyUserAgent(ANDROID_CHROME)).toEqual({
      device: 'mobile',
      browser: 'Chrome',
      os: 'Android',
      bot: false,
    });
  });

  it('treats an iPad and an Android tablet without "Mobile" as tablets', () => {
    expect(classifyUserAgent(IPAD).device).toBe('tablet');
    expect(classifyUserAgent(ANDROID_TABLET).device).toBe('tablet');
  });

  it('recognises desktop Firefox on Windows', () => {
    expect(classifyUserAgent(DESKTOP_FIREFOX)).toEqual({
      device: 'desktop',
      browser: 'Firefox',
      os: 'Windows',
      bot: false,
    });
  });

  it('recognises desktop Safari on macOS', () => {
    expect(classifyUserAgent(DESKTOP_SAFARI)).toEqual({
      device: 'desktop',
      browser: 'Safari',
      os: 'macOS',
      bot: false,
    });
  });

  it('flags Googlebot and other known bots', () => {
    expect(classifyUserAgent(GOOGLEBOT).bot).toBe(true);
    expect(isBotUserAgent(GOOGLEBOT)).toBe(true);
    expect(isBotUserAgent(DESKTOP_FIREFOX)).toBe(false);
  });

  it('handles a missing user agent without throwing', () => {
    expect(classifyUserAgent(null)).toEqual({ device: 'desktop', browser: 'Other', os: 'Other', bot: false });
    expect(classifyUserAgent(undefined).bot).toBe(false);
  });
});

describe('sourceBucket', () => {
  it.each([
    ['https://www.google.com/search?q=cream+sofa', 'google'],
    ['https://www.google.co.uk/', 'google'],
    ['https://www.googleadservices.com/pagead/aclk?gclid=abc', 'google'],
    ['https://l.facebook.com/l.php?u=https%3A%2F%2Fexample.com', 'facebook'],
    ['https://fb.me/sofa', 'facebook'],
    ['https://www.instagram.com/sofafactoryoutlet/', 'instagram'],
    ['https://ig.me/sofa', 'instagram'],
    ['https://wa.me/94771234567', 'whatsapp'],
    ['https://wa.link/sofa', 'whatsapp'],
    ['https://web.whatsapp.com/', 'whatsapp'],
  ])('buckets %s as %s', (referrer, expected) => {
    expect(sourceBucket(referrer)).toBe(expected);
  });

  it('treats a missing referrer as direct', () => {
    expect(sourceBucket(null)).toBe('direct');
    expect(sourceBucket('')).toBe('direct');
    expect(sourceBucket(undefined)).toBe('direct');
  });

  it('falls back to the UTM source when there is no referrer', () => {
    expect(sourceBucket(null, 'facebook')).toBe('facebook');
    expect(sourceBucket(null, 'GOOGLE')).toBe('google');
    expect(sourceBucket(null, 'instagram')).toBe('instagram');
    expect(sourceBucket(null, 'newsletter')).toBe('other');
    expect(sourceBucket(null, 'direct')).toBe('direct');
    expect(sourceBucket(null, 'none')).toBe('direct');
  });

  it('buckets an unknown external site as other', () => {
    expect(sourceBucket('https://example.com/blog/sofas')).toBe('other');
  });

  it('treats our own pages as direct rather than an external referrer', () => {
    expect(sourceBucket('https://www.sofafactoryoutlet.lk/shop/', null, 'sofafactoryoutlet.lk')).toBe('direct');
    expect(
      sourceBucket(
        'https://sofafactoryoutlet.lk/product/l-shape-sofa/',
        'google',
        'sofafactoryoutlet.lk',
      ),
    ).toBe('direct');
  });

  it('keeps only the hostname of a referrer', () => {
    expect(referrerHost('https://www.google.com/search?q=private+search')).toBe('google.com');
    expect(referrerHost('not a url')).toBeNull();
    expect(referrerHost('javascript:alert(1)')).toBeNull();
  });
});
