// A visitor on a phone (Pixel 7, 390 px): filter the shop, open a product, add it to the cart and book a visit.
// Prints PASS/FAIL per step and saves a screenshot of each screen. Run against a RUNNING server whose database
// has the seeded catalogue (it creates one real booking, so use a local or throwaway database).
//   node scripts/qa-phone-journey.mjs http://localhost:3000 test-results/qa-journey
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:3000';
const out = process.argv[3] ?? 'test-results/qa-journey';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 390, height: 844 } });
await context.addInitScript(() => { try { sessionStorage.setItem('sfo-pre', '1'); } catch { /* ignore */ } });
const page = await context.newPage();
const consoleErrors = [];
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160)); });
page.on('pageerror', (e) => consoleErrors.push(`pageerror ${String(e).slice(0, 160)}`));

const results = [];
const step = async (name, fn) => {
  const started = Date.now();
  try {
    const note = await fn();
    results.push(`PASS  ${name}${note ? '  (' + note + ')' : ''}  ${Date.now() - started}ms`);
  } catch (e) {
    results.push(`FAIL  ${name}  ${String(e).split('\n')[0].slice(0, 200)}`);
    await page.screenshot({ path: path.join(out, `fail-${results.length}.jpg`), type: 'jpeg', quality: 60 }).catch(() => {});
  }
};
const shot = (n) => page.screenshot({ path: path.join(out, `${n}.jpg`), type: 'jpeg', quality: 62 });

await step('shop loads with a top bar and two-column grid', async () => {
  await page.goto(`${base}/shop/`, { waitUntil: 'load' });
  await page.getByRole('button', { name: /^Filters \(0\)$/ }).first().waitFor({ timeout: 8000 });
  const cols = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('article')].slice(0, 4).map((a) => Math.round(a.getBoundingClientRect().left));
    return new Set(cards).size;
  });
  await shot('01-shop');
  if (cols !== 2) throw new Error(`expected 2 columns, saw ${cols}`);
  return '2 columns';
});

await step('filters sheet opens, a colour can be chosen and applied', async () => {
  await page.getByRole('button', { name: /^Filters \(0\)$/ }).first().click();
  const close = page.getByRole('button', { name: 'Close filters' });
  await close.waitFor({ timeout: 5000 });
  await shot('02-filters-sheet');
  const chip = page.getByRole('checkbox', { name: /green/i }).first();
  await chip.check({ force: true });
  const apply = page.getByRole('button', { name: /Show \d+ pieces?/ });
  const label = (await apply.first().textContent())?.trim();
  await apply.first().click();
  await page.waitForURL(/colour=green/, { timeout: 8000 });
  const count = await page.getByRole('article').count();
  await shot('03-filtered');
  return `${label}; ${count} cards after applying`;
});

await step('active filter chip can be removed', async () => {
  const chip = page.getByRole('button', { name: /Remove filter: Green/i }).first();
  await chip.click({ timeout: 5000 });
  await page.waitForURL((u) => !u.search.includes('colour='), { timeout: 8000 });
});

await step('product page: gallery, colour chips, sticky Add to cart bar', async () => {
  await page.goto(`${base}/product/luxury-emerald-green-l-shape-sofa-modern-furniture-colombo/`, { waitUntil: 'load' });
  await page.getByRole('button', { name: 'Add to cart', exact: true }).first().waitFor({ timeout: 8000 });
  await shot('04-product-top');
  await page.evaluate(() => window.scrollTo(0, 1400));
  await page.waitForTimeout(700);
  const bar = await page.evaluate(() => { const b = document.querySelector('[data-sticky-bar]'); if (!b) return null; const r = b.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height) }; });
  await shot('05-product-scrolled');
  if (!bar) throw new Error('no [data-sticky-bar] after scrolling past the main buttons');
  return `sticky bar at y=${bar.top}, ${bar.h}px tall`;
});

await step('add to cart gives feedback and the cart holds the item', async () => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: 'Add to cart', exact: true }).first().click();
  await page.getByRole('link', { name: /Cart, 1 item/ }).waitFor({ timeout: 6000 });
  await page.waitForTimeout(600);
  await shot('06-cart-drawer');
  return 'cart link shows 1 item';
});

await step('book a visit: earliest available, details, submit, reference shown', async () => {
  await page.goto(`${base}/book-visit/`, { waitUntil: 'load' });
  await page.getByLabel('Full name').fill('Journey Visitor');
  await page.getByLabel('Phone number').fill('0771234567');
  const earliest = page.getByRole('button', { name: /Earliest available/i });
  if (await earliest.count()) await earliest.first().click();
  await page.waitForTimeout(600);
  await shot('07-booking-filled');
  const consent = page.getByLabel(/I agree that/);
  await consent.check();
  await page.getByRole('button', { name: /Book my visit/ }).click();
  await page.waitForURL(/\/book-visit\/done\/SFO-B-\d+\//, { timeout: 20000 });
  await page.waitForTimeout(800);
  await shot('08-confirmation');
  return page.url().match(/SFO-B-\d+/)?.[0] ?? '';
});

await browser.close();
console.log(results.join('\n'));
console.log(consoleErrors.length ? `console errors: ${[...new Set(consoleErrors)].slice(0, 4).join(' | ')}` : 'no console errors');
