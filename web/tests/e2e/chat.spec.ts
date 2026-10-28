import { expect, test } from '@playwright/test';

async function ask(page: import('@playwright/test').Page, message: string) {
  const input = page.getByLabel('Message to the Sofa Factory Outlet assistant');
  await input.fill(message);
  await page.getByRole('button', { name: 'Send message' }).click();
}

test('chat answers FAQs, recommends products and offers a human handoff', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Open chat assistant' }).click();
  const log = page.getByRole('log', { name: 'Conversation with the Sofa Factory Outlet assistant' });

  await ask(page, 'How long does delivery take?');
  await expect(log).toContainText('10 to 15 working days');
  await expect(log).toContainText(/confirm/i);

  await ask(page, 'Show me a green sofa');
  await expect(log.getByRole('article').first()).toBeVisible();

  await ask(page, 'talk to a person');
  await expect(log.getByRole('button', { name: /Talk to a person on WhatsApp/ })).toBeVisible();
});

