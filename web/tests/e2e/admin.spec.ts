import { expect, test } from '@playwright/test';
import {
  createBookingWithProduct,
  openBookingInAdmin,
  publishedProduct,
  signIn,
} from './helpers';

test('owner manages a booking and edits a product, then signs out', async ({ page }) => {
  const { reference } = await createBookingWithProduct(page, 3_000_001);
  await signIn(page);
  await expect(page.getByRole('button', { name: /Notifications, [1-9]\d* unread/ })).toBeVisible();
  await openBookingInAdmin(page, reference);
  await page.getByLabel('Change status').selectOption('contacted');
  await page.getByRole('button', { name: 'Update status' }).click();
  await expect(page.getByText('Status changed to contacted.', { exact: true })).toBeVisible();

  await page.goto('/admin/products/');
  await page.getByLabel('Search products').fill(publishedProduct.name);
  await page.keyboard.press('Enter');
  await page.getByRole('link', { name: publishedProduct.name }).click();
  const title = `${publishedProduct.name} E2E`;
  await page.getByLabel('Name', { exact: true }).fill(title);
  await page.getByLabel('Slug').fill(publishedProduct.slug);
  await page.getByRole('button', { name: 'Save product' }).click();
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible();
  await page.goto('/shop/?q=emerald');
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();

  await page.goto('/admin/products/');
  await page.getByLabel('Search products').fill(title);
  await page.keyboard.press('Enter');
  await page.getByRole('link', { name: title }).click();
  await page.getByLabel('Name', { exact: true }).fill(publishedProduct.name);
  await page.getByLabel('Slug').fill(publishedProduct.slug);
  await page.getByRole('button', { name: 'Save product' }).click();
  await expect(page.getByText('Saved.', { exact: true })).toBeVisible();

  await page.goto('/admin/');
  await page.getByRole('button', { name: /Account menu for/ }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.goto('/admin/');
  await expect(page).toHaveURL(/\/admin\/login\//);
});

