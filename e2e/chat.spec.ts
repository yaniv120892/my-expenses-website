import { test, expect, Page } from '@playwright/test';

/**
 * Verifies that the assistant's reply renders *incrementally*.
 *
 * A non-streaming implementation would still end up showing the same final
 * text, so asserting on the finished message proves nothing. The check that
 * matters is that the bubble grows across samples while the request is open.
 */

const TOKEN = process.env.E2E_AUTH_TOKEN || '';

async function signIn(page: Page): Promise<void> {
  // Seeded before any app script runs, so the client boots authenticated and
  // the email-verification flow is skipped entirely. These are the keys read
  // by src/services/authService.ts.
  await page.addInitScript((token) => {
    localStorage.setItem('authToken', token);
    localStorage.setItem('isVerified', 'true');
  }, TOKEN);
}

test('assistant reply renders incrementally', async ({ page }) => {
  test.skip(!TOKEN, 'E2E_AUTH_TOKEN not provided');

  await signIn(page);
  await page.goto('/');

  await page.getByRole('button', { name: /chat/i }).click();
  await expect(
    page.getByText('Chat with your Financial Assistant'),
  ).toBeVisible();

  const input = page.getByPlaceholder('Ask about your transactions...');
  await input.fill('Compare my grocery spending in January versus February');
  await input.press('Enter');

  // Scoped to the assistant's bubble specifically. Taking "the last bubble"
  // instead would straddle two elements: the user's message is last until the
  // reply's first token lands, so the observed length drops as the assistant
  // bubble takes over — a decrease that has nothing to do with streaming.
  const reply = page.locator('[data-testid="chat-message"][data-sender="bot"]');

  // Sample the assistant bubble while the response is still arriving.
  const lengths: number[] = [];
  for (let i = 0; i < 25; i++) {
    // The bubble does not exist until the first token renders; a missing one
    // counts as zero length and is filtered out below.
    const text = (await reply.count())
      ? await reply.last().textContent()
      : '';
    lengths.push((text || '').length);
    if (lengths.at(-1)! > 0 && (text || '').includes('26.83%')) break;
    await page.waitForTimeout(120);
  }

  const distinct = [...new Set(lengths.filter((l) => l > 0))];
  expect(
    distinct.length,
    `bubble length only ever observed as ${distinct.join(',')} — text appeared at once, not progressively`,
  ).toBeGreaterThan(1);

  // Growth must be monotonic: deltas append, never replace.
  const growing = lengths.filter((l) => l > 0);
  for (let i = 1; i < growing.length; i++) {
    expect(growing[i]).toBeGreaterThanOrEqual(growing[i - 1]);
  }

  // And the figures the user ends up seeing are the TypeScript-computed ones.
  await expect(reply.last()).toContainText('1,100.00');
  await expect(reply.last()).toContainText('26.83%');
});
