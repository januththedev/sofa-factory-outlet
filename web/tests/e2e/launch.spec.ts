import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('moving between pages never covers the screen with an overlay', async ({ page }) => {
  await page.goto('/');
  // Nothing in the page is a full-screen maroon curtain or preloader any more.
  expect(await page.locator('.page-curtain, .preloader').count()).toBe(0);
  const covered = () => page.evaluate(() => {
    const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return el ? getComputedStyle(el).backgroundColor : '';
  });
  await page.getByRole('link', { name: 'Shop', exact: true }).first().click();
  await expect(page).toHaveURL(/\/shop\/$/);
  expect(await covered()).not.toBe('rgb(132, 35, 35)');
  await expect(page.getByRole('heading', { name: 'Shop', exact: true })).toBeVisible();
});

test('an unknown address gets the site 404 page and a real 404 status', async ({ request, page }) => {
  for (const path of ['/this-page-does-not-exist/', '/product/no-such-sofa/', '/a/b/c/']) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
  }
  await page.goto('/this-page-does-not-exist/');
  await expect(page.getByRole('heading', { name: 'That page is not here.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browse the shop' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Book a visit' }).first()).toBeVisible();
});

test('a super admin adds an admin, who can sign in, change their password and cannot open Admins', async ({ page, browser }) => {
  await signIn(page);
  await page.getByRole('link', { name: 'Admins' }).click();
  await expect(page).toHaveURL(/\/admin\/admins\/$/);
  await expect(page.getByText('Super admin').first()).toBeVisible();

  const email = `new-admin-${Date.now()}@example.test`;
  await page.getByLabel('Name', { exact: true }).fill('Launch Admin');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Role', { exact: true }).selectOption('staff');
  await page.getByRole('button', { name: 'Add account' }).click();
  const temp = page.getByRole('group', { name: 'Temporary password' }).locator('code');
  await expect(temp).toBeVisible();
  const tempPassword = (await temp.textContent())?.trim() ?? '';
  expect(tempPassword.length).toBeGreaterThanOrEqual(10);

  // The new admin signs in on their own browser, is kept out of Admins and Settings, and sets a real password.
  const context = await browser.newContext();
  const other = await context.newPage();
  await other.goto('/admin/login/');
  await other.getByLabel('Email').fill(email);
  await other.getByLabel('Password').fill(tempPassword);
  await other.getByRole('button', { name: 'Sign in' }).click();
  await expect(other).toHaveURL(/\/admin\/$/);
  await expect(other.getByRole('link', { name: 'Admins' })).toHaveCount(0);
  await other.goto('/admin/admins/');
  await expect(other).toHaveURL(/\/admin\/\?notice=owner-only/);
  await expect(other.getByText('only open to super admins')).toBeVisible();

  await other.goto('/admin/account/');
  await other.getByLabel('Current password').fill(tempPassword);
  await other.getByLabel('New password', { exact: true }).fill('my-new-password-77');
  await other.getByLabel('New password again').fill('my-new-password-77');
  await other.getByRole('button', { name: 'Change password' }).click();
  await expect(other.getByText('Password changed.')).toBeVisible();
  await context.close();

  // The old temporary password no longer works; the new one does.
  const fresh = await browser.newContext();
  const check = await fresh.newPage();
  await check.goto('/admin/login/');
  await check.getByLabel('Email').fill(email);
  await check.getByLabel('Password').fill(tempPassword);
  await check.getByRole('button', { name: 'Sign in' }).click();
  await expect(check).toHaveURL(/\/admin\/login\//);
  await check.getByLabel('Password').fill('my-new-password-77');
  await check.getByRole('button', { name: 'Sign in' }).click();
  await expect(check).toHaveURL(/\/admin\/$/);
  await fresh.close();
});

test('search pages, FAQ markup and llms.txt are published for search engines and AI assistants', async ({ page, request }) => {
  for (const [path, heading] of [
    ['/faq/', 'Sofa questions, answered'],
    ['/sofa-shop-colombo/', 'A Colombo sofa shop that makes its own sofas'],
    ['/custom-sofas-sri-lanka/', 'Custom-made sofas, built for your room'],
  ] as const) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
    const types = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(types.join(' '), path).toContain('"FAQPage"');
  }
  await page.goto('/');
  const home = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(' ');
  expect(home).toContain('"FurnitureStore"');
  expect(home).toContain('"WebSite"');

  const llms = await (await request.get('/llms.txt')).text();
  expect(llms).toContain('## How to buy');
  expect(llms).toContain('/custom-sofas-sri-lanka/');
  expect(llms).toContain('## Common questions');
  const sitemap = await (await request.get('/sitemaps/pages.xml')).text();
  expect(sitemap).toContain('/faq/');
  expect(sitemap).toContain('/sofa-shop-colombo/');
});
