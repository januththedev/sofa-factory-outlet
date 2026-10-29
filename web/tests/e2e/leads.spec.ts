import { expect, test } from '@playwright/test';
import { addPublishedProduct, signIn } from './helpers';
test.setTimeout(45000);

test('a mobile product selection becomes an assigned lead and a quotation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    '/shop/?utm_source=facebook&utm_medium=social&utm_campaign=quote-release',
  );
  await addPublishedProduct(page);
  await page
    .getByRole('dialog')
    .getByRole('link', { name: 'Request a quote', exact: true })
    .click();
  await expect(page).toHaveURL(/\/request-quote\/$/);
  await expect(
    page.getByRole('heading', { name: 'Your selected pieces' }),
  ).toBeVisible();
  await page
    .getByLabel('Full name', { exact: true })
    .fill('Quote Journey Visitor');
  await page.getByLabel('Phone number', { exact: true }).fill('0779876501');
  await page.getByLabel('City or district', { exact: true }).fill('Dehiwala');
  await page
    .getByLabel('Budget (optional)', { exact: true })
    .fill('LKR 180,000');
  await page
    .getByLabel('Room dimensions (optional)', { exact: true })
    .fill('4m × 5m');
  await page.screenshot({ path: '/tmp/sofa-quote-phone.png', fullPage: true });
  await page.locator('#quote-consent').check();
  await page
    .getByRole('button', { name: 'Request my quote', exact: true })
    .click();
  await expect(
    page.getByText('Request received', { exact: true }),
  ).toBeVisible();
  const reference = await page.locator('[role="status"] strong').textContent();
  expect(reference).toMatch(/^SFO-Q-[A-F0-9]{10}$/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await signIn(page);
  await page.goto('/admin/leads/');
  await page.getByRole('link', { name: reference!, exact: true }).click();
  await expect(page.getByRole('heading', { name: reference! })).toBeVisible();
  await expect(
    page.getByText('quote-release', { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({ path: '/tmp/sofa-lead-desktop.png', fullPage: true });
  const assigned = page.getByLabel('Assigned salesperson');
  await assigned.selectOption({ index: 1 });
  await page.getByLabel('Stage', { exact: true }).selectOption('contacted');
  await page
    .getByLabel('Next follow-up (Colombo time)')
    .fill('2026-11-02T10:30');
  await page
    .getByLabel('Activity note')
    .fill('Confirmed fabrics by phone. Follow up Monday.');
  await page.getByRole('button', { name: 'Save lead', exact: true }).click();
  await expect(
    page.getByText('Lead updated. Follow-up and activity saved.'),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Stage', { exact: true })).toHaveValue(
    'contacted',
  );
  await expect(page.getByLabel('Next follow-up (Colombo time)')).toHaveValue(
    '2026-11-02T10:30',
  );
  await expect(page.getByText(/Confirmed fabrics by phone/)).toBeVisible();
  await page
    .getByRole('button', { name: 'Prepare quotation', exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/invoices\/\d+\/edit\/$/);
  await expect(
    page.getByRole('heading', { name: 'Edit quotation', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('Quote Journey Visitor', { exact: true }),
  ).toBeVisible();
});

test('quote validation preserves entered details and guessed booking references reveal no visit', async ({
  page,
}) => {
  await page.goto('/request-quote/');
  await page
    .getByLabel('Full name', { exact: true })
    .fill('Validation Visitor');
  await page.getByLabel('Phone number', { exact: true }).fill('invalid-phone');
  await page.getByLabel('City or district', { exact: true }).fill('Colombo');
  await page.locator('#quote-consent').check();
  await page.getByRole('button', { name: 'Request my quote' }).click();
  await expect(page.getByRole('alert').first()).toBeVisible();
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue(
    'Validation Visitor',
  );
  await expect(page.getByLabel('Phone number', { exact: true })).toHaveValue(
    'invalid-phone',
  );
  await page.goto('/book-visit/done/SFO-B-0001/');
  await expect(
    page.getByRole('heading', { name: 'Your visit details are private.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Your visit is booked.' }),
  ).toHaveCount(0);
  expect(
    (await page.request.get('/api/bookings/SFO-B-0001/ics/')).status(),
  ).toBe(404);
});
