import { expect, test } from '@playwright/test';
import { productPath } from './helpers';

test('product page shows its gallery', async ({ page }) => {
  await page.goto(productPath());
  await expect(page.getByRole('button', { name: /Open image 1 of/ })).toBeVisible();
});

test('a colour choice swaps the main gallery image', async ({ page }) => {
  await page.goto(productPath());
  const colours = page.getByRole('group', { name: /Colour:/ }).getByRole('button');
  const colourCount = await colours.count();
  test.fixme(colourCount < 2, 'The running seed has no product with a second colour variant to swap.');
  const mainImage = page.getByRole('button', { name: /Open image 1 of/ }).getByRole('img');
  const before = await mainImage.getAttribute('src');
  await colours.nth(1).click();
  await expect(mainImage).not.toHaveAttribute('src', before ?? '');
});

test('adding to the cart updates its count and the sofa question opens chat', async ({ page }) => {
  await page.goto(productPath());
  await page.getByRole('button', { name: 'Add to cart', exact: true }).first().click();
  await expect(page.getByRole('link', { name: 'Cart, 1 item' })).toBeVisible();
  await page.getByRole('button', { name: 'Ask about this sofa' }).first().click();
  await expect(page.getByRole('dialog', { name: 'Sofa Factory Outlet assistant' })).toBeVisible();
});

