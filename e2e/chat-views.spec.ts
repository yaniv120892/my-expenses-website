import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

/**
 * Captures the assistant's structured replies.
 *
 * The assertions are the point; the screenshots exist so a reviewer can see
 * that a "list my transactions" answer is now a table rather than the wall of
 * pipe-separated text it used to be. Shot at phone width because that is where
 * the old rendering was worst.
 *
 * The assertions hold against either model, because they check content that
 * comes from the structured view rather than from anything the model wrote.
 *
 * The committed screenshots were captured against a real model. Re-running
 * with the e2e mock overwrites them with far uglier prose — the mock echoes
 * each tool result verbatim, which is what lets the API harness prove figures
 * come from TypeScript. That echo is a harness artefact, not the product.
 */

const TOKEN = process.env.E2E_AUTH_TOKEN || '';

const PHONE = { width: 390, height: 844 };

async function openChat(page: import('@playwright/test').Page) {
  await signIn(page, TOKEN);
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /chat/i }).click();
  await expect(page.getByText('Financial Assistant')).toBeVisible();
}

async function ask(page: import('@playwright/test').Page, question: string) {
  const input = page.getByPlaceholder('Ask about your transactions...');
  await input.fill(question);
  await input.press('Enter');
}

/**
 * Waits for the reply's prose as well as its card.
 *
 * The card lands first — the tool result exists before the model has written
 * anything about it — so screenshotting as soon as the card appears captures a
 * reply that is still mid-flight.
 */
async function waitForProse(reply: import('@playwright/test').Locator) {
  await expect
    .poll(
      async () =>
        (
          (await reply
            .last()
            .locator('[data-testid="chat-message-text"]')
            .textContent()
            .catch(() => '')) || ''
        ).length,
      { timeout: 30_000 },
    )
    .toBeGreaterThan(20);
}

test.describe('assistant renders structured results', () => {
  test.skip(!TOKEN, 'E2E_AUTH_TOKEN not provided');
  test.use({ viewport: PHONE });

  test('a list question renders a transaction table, not prose', async ({
    page,
  }) => {
    await openChat(page);
    await ask(page, 'List my transactions for this year');

    const reply = page.locator(
      '[data-testid="chat-message"][data-sender="bot"]',
    );

    // The rows come from the structured view, so a real description renders
    // even though the model never received one.
    await expect(reply.last()).toContainText('Monthly shop', {
      timeout: 20_000,
    });
    await expect(reply.last()).toContainText('Groceries');

    // The old failure mode: the model retyping rows as "date | desc | amount".
    await expect(reply.last()).not.toContainText('|');

    await waitForProse(reply);

    await page.screenshot({
      path: 'docs/proof-of-work/chat-transaction-list-mobile.png',
      fullPage: false,
    });
  });

  test('a category question renders a breakdown chart', async ({ page }) => {
    await openChat(page);
    await ask(page, 'What percentage of my spending was by category?');

    const reply = page.locator(
      '[data-testid="chat-message"][data-sender="bot"]',
    );

    await expect(reply.last()).toContainText('Groceries', { timeout: 20_000 });

    // Assert on a drawn slice, not on the <svg>: ResponsiveContainer renders an
    // empty svg even when the chart has no size, so `svg` being visible proves
    // nothing about whether the donut actually appeared.
    await expect(
      reply.last().locator('path.recharts-sector').first(),
    ).toBeVisible();
    await expect(reply.last().locator('path.recharts-sector')).toHaveCount(2);

    await waitForProse(reply);

    await page.screenshot({
      path: 'docs/proof-of-work/chat-category-breakdown-mobile.png',
      fullPage: false,
    });
  });
});
