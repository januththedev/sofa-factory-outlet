import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { productPath } from './helpers';

for (const path of ['/', '/shop/', productPath(), '/book-visit/', '/cart/']) {
  test(`${path} has no serious or critical accessibility violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).analyze();
    const violations = results.violations.filter((violation) =>
      violation.impact === 'serious' || violation.impact === 'critical');
    expect(violations).toEqual([]);
  });
}

