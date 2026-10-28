import { expect, test } from '@playwright/test';
import { productPath } from './helpers';

test.use({ viewport: { width: 390, height: 844 } });

test('phone filters apply draft choices together and expose removable chips', async ({ page }) => {
  await page.goto('/shop/?pageSize=48');
  await page.getByRole('button', { name: /^Filters \(/ }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Filters', exact: true });
  await expect(sheet).toBeVisible();
  const checkbox = sheet.getByRole('group', { name: 'Colour', exact: true }).getByRole('checkbox').first();
  await checkbox.check();
  await expect(page).not.toHaveURL(/colour=/);
  await expect(checkbox).toBeChecked();
  const apply = sheet.getByRole('button', { name: /^Show \d+ pieces$/ });
  await expect(apply).toBeEnabled();
  const total = Number((await apply.innerText()).match(/\d+/)?.[0]);
  await apply.click();
  await expect(sheet).not.toBeVisible();
  await expect(page).toHaveURL(/colour=/);
  await expect(page.getByRole('article')).toHaveCount(total);
  await page.getByRole('button', { name: /^Remove filter:/ }).first().click();
  await expect(page).not.toHaveURL(/colour=/);
});

test('phone filter dialog traps focus and discards changes on Escape or backdrop tap', async ({ page }) => {
  await page.goto('/shop/');
  const trigger = page.getByRole('button', { name: /^Filters \(/ }).first();
  await trigger.click();
  const sheet = page.getByRole('dialog', { name: 'Filters', exact: true });
  const close = sheet.getByRole('button', { name: 'Close filters' });
  await expect(close).toBeFocused();
  await expect(page.locator('body')).toHaveCSS('overflow', 'hidden');
  await page.keyboard.press('Shift+Tab');
  await expect(sheet.getByRole('button', { name: 'Clear all', exact: true })).toBeFocused();
  await sheet.getByRole('group', { name: 'Colour', exact: true }).getByRole('checkbox').first().check();
  await page.keyboard.press('Escape');
  await expect(sheet).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page).not.toHaveURL(/colour=/);
  await expect(page.locator('body')).not.toHaveCSS('overflow', 'hidden');
  await trigger.click();
  await sheet.click({ position: { x: 5, y: 5 } });
  await expect(sheet).not.toBeVisible();
});

test('phone gallery has a counter, a dismissible viewer and visible cart feedback', async ({ page }) => {
  await page.goto(productPath());
  const image = page.getByRole('button', { name: /Open image 1 of/ });
  await expect(page.getByRole('status').filter({ hasText: /^1 \/ \d+$/ })).toBeVisible();
  await image.click();
  const viewer = page.getByRole('dialog', { name: 'Product image viewer' });
  await expect(viewer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(viewer).not.toBeVisible();
  await page.getByRole('button', { name: 'Add to cart', exact: true }).first().click();
  await page.getByRole('button', { name: 'Close cart' }).click();
  await expect(page.getByRole('button', { name: 'Added to cart', exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'View cart', exact: true }).first()).toBeVisible();
});

test('Back to results restores the filtered URL and list position', async ({ page }) => {
  await page.goto('/shop/?colour=green&pageSize=48');
  const tile = page.getByRole('article').last().getByRole('link');
  await tile.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => window.scrollY);
  await tile.click();
  await page.getByRole('link', { name: 'Back to results', exact: true }).click();
  await expect(page).toHaveURL(/\/shop\/\?colour=green&pageSize=48/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(scroll, -1);
});
