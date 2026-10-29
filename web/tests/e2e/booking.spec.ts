import { expect, test } from '@playwright/test';
import { createBookingWithProduct, submitBooking } from './helpers';

test('a cart becomes a confirmed booking with a calendar file', async ({
  page,
}) => {
  const { reference } = await createBookingWithProduct(page, 1_000_001);
  await expect(page.getByText(reference, { exact: true })).toBeVisible();
  const calendar = await page.request.get(`/api/bookings/${reference}/ics/`);
  expect(calendar.status()).toBe(200);
  expect(calendar.headers()['content-type']).toContain('text/calendar');
});

test('a slot at capacity is disabled', async ({ page }) => {
  const first = await submitBooking(page, 2_000_001);
  for (let index = 2; index <= first.remaining; index += 1) {
    await submitBooking(page, 2_000_000 + index);
  }
  await page.goto('/book-visit/');
  await page.getByRole('button', { name: first.dateName }).click();
  const time = first.slotName.replace(/\s*\d+ places? left\s*$/, '').trim();
  expect(time).not.toBe('');
  const fullSlot = page
    .getByRole('group', { name: 'Time slot', exact: true })
    .getByRole('radio', { name: new RegExp(`^${time}`) });
  await expect(fullSlot).toBeDisabled();
});
