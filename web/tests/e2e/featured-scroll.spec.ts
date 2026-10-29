import { expect, test } from '@playwright/test';

// Captured photos are not committed. Supply a local image so lazy WebGL texture
// loading cannot fail before the scroll regression is exercised.
test.beforeEach(async ({ page }) => {
  await page.route('**/blob/**', route => route.fulfill({ path: 'public/brand/mark.png', contentType: 'image/png' }));
});

test('vertical scrolling over Featured pieces stays with smooth scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-preloaded', '1');
  await expect(page.locator('html')).toHaveClass(/lenis/);
  const region = page.getByRole('region', {
    name: 'Featured pieces',
    exact: true,
  });
  await expect(region).toBeVisible();
  const handled = await region.evaluate((node) => {
    const event = new WheelEvent('wheel', {
      deltaY: 150,
      bubbles: true,
      cancelable: true,
    });
    node.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(handled).toBe(true);
  const positions = await page.evaluate(
    () =>
      new Promise<number[]>((resolve) => {
        const points: number[] = [];
        const sample = () => {
          points.push(window.scrollY);
          if (points.length < 40) requestAnimationFrame(sample);
          else resolve(points);
        };
        requestAnimationFrame(sample);
      }),
  );
  expect(positions.at(-1)).toBeGreaterThan(positions[0]);
  expect(
    positions.every((y, index) => index === 0 || y >= positions[index - 1] - 1),
  ).toBe(true);
});

test('tablet horizontal rail stays native while vertical wheel scroll remains smooth', async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 900 });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-preloaded', '1');
  await expect(page.locator('html')).toHaveClass(/lenis/);
  const region = page.getByRole('region', {
    name: 'Featured pieces',
    exact: true,
  });
  expect(
    await region.evaluate((node) => {
      const e = new WheelEvent('wheel', {
        deltaY: 150,
        bubbles: true,
        cancelable: true,
      });
      node.dispatchEvent(e);
      return e.defaultPrevented;
    }),
  ).toBe(true);
  expect(
    await region.evaluate((node) => {
      const e = new WheelEvent('wheel', {
        deltaX: 150,
        bubbles: true,
        cancelable: true,
      });
      node.dispatchEvent(e);
      return e.defaultPrevented;
    }),
  ).toBe(false);
  await region.evaluate((node) => {
    node.scrollLeft = 300;
  });
  await expect
    .poll(() => region.evaluate((node) => node.scrollLeft))
    .toBeGreaterThan(0);
});

test('phone rail can move sideways without blocking native page scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-preloaded', '1');
  const region = page.getByRole('region', {
    name: 'Featured pieces',
    exact: true,
  });
  await expect(region).toBeVisible();
  expect(
    await region.evaluate((node) => {
      const e = new WheelEvent('wheel', {
        deltaY: 100,
        bubbles: true,
        cancelable: true,
      });
      node.dispatchEvent(e);
      return e.defaultPrevented;
    }),
  ).toBe(false);
  await region.evaluate((node) => {
    node.scrollLeft = 250;
  });
  await expect
    .poll(() => region.evaluate((node) => node.scrollLeft))
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test('a failed hero texture preserves the storefront and featured section', async ({page}) => {
  await page.setViewportSize({width:1440,height:900});
  await page.route('**/blob/site/hero-living-room/**', route=>route.fulfill({status:404,body:'Texture unavailable'}));
  const failedTexture=page.waitForResponse(response=>response.url().includes('/blob/site/hero-living-room/') && response.status()===404);
  await page.goto('/'); await failedTexture;
  await expect(page.locator('[data-hero-canvas]')).toBeAttached();
  await expect(page.locator('[data-hero-canvas] canvas')).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'Made recently, ready to see.'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'This page couldn’t load'})).toHaveCount(0);
});
