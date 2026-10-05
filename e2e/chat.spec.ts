import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

/**
 * Verifies that the assistant's reply renders *incrementally*.
 *
 * A non-streaming implementation would still end up showing the same final
 * text, so asserting on the finished message proves nothing. The check that
 * matters is that the bubble grows across renders while the request is open.
 */

const TOKEN = process.env.E2E_AUTH_TOKEN || '';

declare global {
  interface Window {
    __botReplyLengths?: number[];
  }
}

test('assistant reply renders incrementally', async ({ page }) => {
  test.skip(!TOKEN, 'E2E_AUTH_TOKEN not provided');
  // The first request compiles the chat route, which can take most of a minute.
  test.setTimeout(120_000);

  await signIn(page, TOKEN);
  await page.goto('/dashboard');

  await page.getByRole('button', { name: /chat/i }).click();
  await expect(page.getByText('Financial Assistant')).toBeVisible();

  // Recorded inside the page because the mock streams only two chunks 120ms
  // apart, and polling from the test process misses the first on a slow runner.
  await page.evaluate(() => {
    const lengths: number[] = [];
    window.__botReplyLengths = lengths;
    new MutationObserver(() => {
      const bubbles = document.querySelectorAll(
        '[data-testid="chat-message"][data-sender="bot"]',
      );
      const last = bubbles[bubbles.length - 1];
      if (last) {
        lengths.push((last.textContent || '').length);
      }
    }).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  });

  const input = page.getByPlaceholder('Ask about your transactions...');
  await input.fill('Compare my grocery spending in January versus February');
  await input.press('Enter');

  // Scoped to the assistant's bubble specifically — "the last bubble" would
  // straddle the user message and the reply as the reply starts rendering.
  const reply = page.locator('[data-testid="chat-message"][data-sender="bot"]');
  await expect(reply.last()).toContainText('26.83%', { timeout: 90_000 });

  const lengths = (
    await page.evaluate(() => window.__botReplyLengths ?? [])
  ).filter((length) => length > 0);
  const distinct = [...new Set(lengths)];
  expect(
    distinct.length,
    `bubble length only ever observed as ${distinct.join(',')} — text appeared at once, not progressively`,
  ).toBeGreaterThan(1);

  // Deltas append, never replace.
  for (let i = 1; i < lengths.length; i++) {
    expect(lengths[i]).toBeGreaterThanOrEqual(lengths[i - 1]);
  }

  await expect(reply.last()).toContainText('1,100.00');
  await expect(reply.last()).toContainText('26.83%');
});

test('a suggested prompt sends itself and clears the empty state', async ({
  page,
}) => {
  test.skip(!TOKEN, 'E2E_AUTH_TOKEN not provided');

  await signIn(page, TOKEN);
  await page.goto('/dashboard');

  await page.getByRole('button', { name: /chat/i }).click();

  const prompts = page.locator('[data-testid="chat-suggested-prompt"]');
  await expect(prompts.first()).toBeVisible();

  const promptText = await prompts.first().textContent();
  await prompts.first().click();

  await expect(
    page.locator('[data-testid="chat-message"][data-sender="user"]'),
  ).toHaveText(promptText!);
  await expect(prompts).toHaveCount(0);
});
