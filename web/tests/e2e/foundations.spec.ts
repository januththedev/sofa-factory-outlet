import { expect, test } from '@playwright/test';

test('health reports the seeded catalogue', async ({ request }) => {
  const res = await request.get('/api/health/');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.db).toBe('pglite');
  expect(body.products).toMatchObject({ total: 35, published: 15, hidden: 20 });
  expect(body.variants).toMatchObject({ total: 35, withImages: 35 });
});

test('the page renders product photos served from local storage', async ({ page }) => {
  await page.goto('/shop/');
  await expect(page).toHaveTitle(/Sofa Factory Outlet/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const first = page.locator('picture img').first();
  await expect(first).toBeVisible();
  await expect.poll(() => first.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  // The browser picked a pre-generated AVIF/WebP width, not an on-demand optimisation URL.
  const src = await first.evaluate((img: HTMLImageElement) => img.currentSrc);
  expect(src).toMatch(/\/blob\/products\/\d+\/[0-9a-f]{8}\/\d+\.(avif|webp)$/);
});

test('legacy WordPress URLs redirect permanently', async ({ request }) => {
  for (const [from, to] of [
    ['/product-category/sofa/', '/sofas/'],
    ['/product-category/chair/', '/chairs/'],
    ['/checkout/', '/book-visit/'],
  ]) {
    const res = await request.get(from, { maxRedirects: 0 });
    expect(res.status(), from).toBe(301);
    expect(new URL(res.headers().location, 'http://x').pathname, from).toBe(to);
  }
});
