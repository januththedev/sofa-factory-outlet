import { expect, test } from '@playwright/test';
import { hiddenProduct, productPath } from './helpers';

test('crawler endpoints and hidden-product redirects are correct', async ({ request }) => {
  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.status()).toBe(200);
  const sitemapBody = await sitemap.text();
  for (const name of ['pages', 'products', 'categories', 'guides', 'images']) {
    expect(sitemapBody).toContain(`/sitemaps/${name}.xml`);
  }

  const robots = await request.get('/robots.txt');
  const robotsBody = await robots.text();
  expect(robotsBody).toMatch(/Allow:\s*\//i);
  expect(robotsBody).toContain('/sitemap.xml');

  const hidden = await request.get(productPath(hiddenProduct.slug), { maxRedirects: 0 });
  expect(hidden.status()).toBe(301);
  expect(hidden.headers().location).toMatch(/^\/(ottomans|shop)\/$/);

  expect((await request.get('/llms.txt')).status()).toBe(200);
});

test('an unpriced product has Product JSON-LD without offers', async ({ page }) => {
  await page.goto(productPath());
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const product = blocks.map((block) => JSON.parse(block) as Record<string, unknown>)
    .find((value) => value['@type'] === 'Product');
  expect(product).toBeDefined();
  expect(product).not.toHaveProperty('offers');
});

