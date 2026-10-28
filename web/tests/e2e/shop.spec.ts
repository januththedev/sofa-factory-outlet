import { expect, test } from '@playwright/test';
import { hiddenProduct, publishedProduct } from './helpers';

test('shop lists published products, filters and paginates without exposing hidden products', async ({ page }) => {
  await page.goto('/shop/?pageSize=48');
  await expect(page.getByRole('article')).toHaveCount(15);
  await expect(page.getByRole('link', { name: hiddenProduct.name })).toHaveCount(0);

  const colour = page.getByRole('group', { name: 'Colour' }).getByRole('checkbox').first();
  const colourText = await colour.evaluate((element) => element.parentElement?.textContent ?? '');
  const colourCount = Number(colourText.match(/(\d+)\s*$/)?.[1]);
  await colour.check();
  await expect(page).toHaveURL(/colour=/);
  await expect(page.getByRole('article')).toHaveCount(colourCount);

  await page.goto('/shop/?pageSize=48');
  const shape = page.getByRole('group', { name: 'Shape' }).getByRole('checkbox').first();
  const shapeText = await shape.evaluate((element) => element.parentElement?.textContent ?? '');
  const shapeCount = Number(shapeText.match(/(\d+)\s*$/)?.[1]);
  await shape.check();
  await expect(page).toHaveURL(/shape=/);
  await expect(page.getByRole('article')).toHaveCount(shapeCount);

  await page.goto('/shop/?colour=green&pageSize=1');
  await page.getByRole('navigation', { name: 'Product pages' }).getByRole('link', { name: '2' }).click();
  await expect(page).toHaveURL(/colour=green/);
  await expect(page).toHaveURL(/page=2/);

  await page.goto('/shop/');
  await page.getByLabel('Search products').fill('emereld');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByRole('link', { name: publishedProduct.name })).toBeVisible();
});

