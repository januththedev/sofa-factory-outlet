import { expect, test } from '@playwright/test';
import { createBookingWithProduct, openBookingInAdmin, signIn } from './helpers';

test('a booking converts to an invoice with a downloadable PDF', async ({ page }) => {
  const { reference } = await createBookingWithProduct(page, 4_000_001);
  await signIn(page);
  await openBookingInAdmin(page, reference);
  await page.getByRole('button', { name: 'Convert to invoice' }).click();
  await expect(page).toHaveURL(/\/admin\/invoices\/\d+\/$/);
  const invoiceId = page.url().match(/\/invoices\/(\d+)\//)?.[1];
  if (!invoiceId) throw new Error('The converted invoice URL did not contain an invoice ID.');
  await page.getByRole('link', { name: 'Edit draft' }).click();
  await page.getByRole('button', { name: 'Issue invoice' }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/invoices/${invoiceId}/$`));
  const response = await page.context().request.get(`/api/invoices/${invoiceId}/pdf/`);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/pdf');
});

