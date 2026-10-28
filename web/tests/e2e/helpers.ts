import { expect, type Page } from '@playwright/test';

export const publishedProduct = {
  name: 'Luxury Emerald Green L-Shape Sofa',
  slug: 'luxury-emerald-green-l-shape-sofa-modern-furniture-colombo',
};

export const hiddenProduct = {
  name: 'Tramae',
  slug: 'tramae',
};

export function productPath(slug = publishedProduct.slug) {
  return `/product/${slug}/`;
}

export async function signIn(page: Page) {
  const email = process.env.E2E_OWNER_EMAIL;
  const password = process.env.E2E_OWNER_PASSWORD;
  expect(email, 'E2E_OWNER_EMAIL must be configured').toBeTruthy();
  expect(password, 'E2E_OWNER_PASSWORD must be configured').toBeTruthy();
  await page.goto('/admin/login/');
  await page.getByLabel('Email').fill(email ?? '');
  await page.getByLabel('Password').fill(password ?? '');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/admin\/$/);
}

export async function addPublishedProduct(page: Page) {
  await page.goto(productPath());
  await page.getByRole('button', { name: 'Add to cart', exact: true }).first().click();
  await expect(page.getByRole('link', { name: 'Cart, 1 item' })).toBeVisible();
}

function bookingPhone(sequence: number) {
  return `077${String(sequence % 10_000_000).padStart(7, '0')}`;
}

export async function submitBooking(page: Page, sequence: number) {
  await page.goto('/book-visit/');
  await page.getByLabel('Full name').fill(`E2E Visitor ${sequence}`);
  await page.getByLabel('Phone number').fill(bookingPhone(sequence));

  const calendar = page.getByRole('grid');
  const openDate = calendar.getByRole('button', {
    name: /^(?!.*(?:fully booked|closed|not available)).+$/,
  }).first();
  const dateName = await openDate.getAttribute('aria-label');
  await openDate.click();

  const slots = page.getByRole('group', { name: 'Time slot', exact: true }).getByRole('radio');
  let slot = slots.first();
  for (let index = 0; index < await slots.count(); index += 1) {
    const candidate = slots.nth(index);
    if (!(await candidate.isDisabled())) {
      slot = candidate;
      break;
    }
  }
  // The radio is visually hidden inside its label (the drawn circle covers it), so click the label like a visitor.
  await slot.locator('xpath=..').click();
  await expect(slot).toBeChecked();
  const slotName = await slot.evaluate((element) => element.parentElement?.textContent?.trim() ?? '');
  const remaining = Number(slotName.match(/(\d+) places? left/)?.[1]);
  await page.getByLabel(/I agree that/).check();
  await page.getByRole('button', { name: 'Book my visit' }).click();
  await expect(page).toHaveURL(/\/book-visit\/done\/SFO-B-\d+\/$/);
  const reference = page.url().match(/(SFO-B-\d+)/)?.[1];
  expect(reference).toMatch(/^SFO-B-\d{4,}$/);
  return { dateName: dateName ?? '', reference: reference ?? '', remaining, slotName };
}

export async function createBookingWithProduct(page: Page, sequence: number) {
  await addPublishedProduct(page);
  return submitBooking(page, sequence);
}

export async function openBookingInAdmin(page: Page, reference: string) {
  await page.goto('/admin/bookings/');
  await page.getByRole('link', { name: reference, exact: true }).first().click();
  await expect(page.getByRole('heading', { name: reference })).toBeVisible();
}

