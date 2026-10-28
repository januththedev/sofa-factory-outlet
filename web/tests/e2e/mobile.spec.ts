import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 360, height: 800 } });

for (const path of ['/', '/shop/']) {
  test(`${path} fits at 360px and its menu opens`, async ({ page }) => {
    await page.goto(path);
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Mobile' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  });
}
