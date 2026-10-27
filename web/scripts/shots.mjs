// Visual check: drives a real browser through the landing page and saves screenshots.
//   node scripts/shots.mjs <baseUrl> <outDir> <desktop|mobile|reduced>
// Prints console/page errors and which canvases exist, so WebGL gating can be verified.
import fs from 'node:fs';
import path from 'node:path';
import { chromium, devices } from '@playwright/test';

const [base = 'http://localhost:3200', out = 'shots', mode = 'desktop'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const browser = await chromium.launch();
const context = await browser.newContext(
  mode === 'mobile' ? { ...devices['Pixel 7'] } : { viewport: { width: 1440, height: 900 }, reducedMotion: mode === 'reduced' ? 'reduce' : 'no-preference' },
);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 300)}`);
});

// The dev server compiles on first request; retry until it answers.
for (let attempt = 0; ; attempt += 1) {
  try {
    await page.goto(`${base}/`, { waitUntil: 'load', timeout: 120_000 });
    break;
  } catch (error) {
    if (attempt > 20) throw error;
    await sleep(3000);
  }
}

const shot = async (name) => {
  await page.screenshot({ path: path.join(out, `${mode}-${name}.png`) });
  console.log(`shot ${mode}-${name}`);
};
const scrollTo = async (y, wait = 1300) => {
  await page.evaluate((value) => window.scrollTo(0, value), y);
  await sleep(wait);
};
const sectionTop = (selector) =>
  page.evaluate((s) => {
    const el = document.querySelector(s)?.closest('section, footer');
    return el ? el.getBoundingClientRect().top + window.scrollY : null;
  }, selector);
const vh = await page.evaluate(() => window.innerHeight);
const canvases = () => page.evaluate(() => [...document.querySelectorAll('canvas')].map((c) => `${c.closest('[data-hero-canvas]') ? 'hero' : c.closest('[data-explorer-stage]') ? 'explorer' : 'other'}:${c.width}x${c.height}`));

if (mode === 'desktop') {
  await sleep(500);
  await shot('00-preloader');
}
await sleep(mode === 'desktop' ? 4200 : 1800);
await shot('01-hero');
console.log('canvases at hero:', JSON.stringify(await canvases()));
if (mode === 'desktop') {
  await page.mouse.move(700, 400);
  await page.mouse.move(820, 460, { steps: 8 });
  await sleep(250);
  await shot('01b-hero-ripple');
}

// Marquee
await scrollTo((await sectionTop('#hero-title')) + vh * 0.95, 900);
await shot('02-marquee');

// Factory story (pinned on desktop: 340% of the viewport)
const factory = await sectionTop('#factory-heading');
if (mode === 'desktop') {
  for (const [i, p] of [0.06, 0.3, 0.55, 0.8].entries()) {
    await scrollTo(factory + p * 3.4 * vh, 1800);
    await shot(`03-factory-${i + 1}`);
  }
} else {
  await scrollTo(factory, 900);
  await shot('03-factory-1');
  await scrollTo(factory + vh * 1.1, 900);
  await shot('03-factory-2');
}

// Collections rail
const collections = await sectionTop('#collections-heading');
if (mode === 'desktop') {
  const distance = await page.evaluate(() => {
    const ul = document.querySelector('.rail ul');
    return ul ? ul.scrollWidth - window.innerWidth + 96 : 0;
  });
  await scrollTo(collections + 20, 1200);
  await shot('04-collections-start');
  await scrollTo(collections + distance * 0.55, 1500);
  await page.mouse.move(520, 420);
  await page.mouse.move(540, 430, { steps: 6 });
  await sleep(1500);
  await shot('04-collections-hover');
  await scrollTo(collections + distance, 1500);
  await shot('04-collections-end');
} else {
  await scrollTo(collections, 900);
  await shot('04-collections');
}

// Colour explorer
const explorer = await sectionTop('#explorer-heading');
await scrollTo(explorer, 5000);
await shot('05-explorer');
console.log('canvases at explorer:', JSON.stringify(await canvases()));
const swatches = page.getByRole('radio');
const count = await swatches.count();
if (count > 2) {
  await swatches.nth(2).click();
  await sleep(1800);
  await shot('05-explorer-swatch');
}

// Featured, proof, visit, footer
for (const [name, selector] of [
  ['06-featured', '#featured-heading'],
  ['07-proof', '#proof-heading'],
  ['08-visit', '#visit-heading'],
]) {
  await scrollTo(await sectionTop(selector), 1600);
  await shot(name);
}
await scrollTo(await page.evaluate(() => document.documentElement.scrollHeight), 2500);
await shot('09-footer');

const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
console.log('horizontal overflow px:', horizontalOverflow);
console.log('errors:', errors.length ? `\n  ${[...new Set(errors)].join('\n  ')}` : 'none');
await browser.close();
