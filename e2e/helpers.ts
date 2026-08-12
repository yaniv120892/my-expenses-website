import { Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

/**
 * Authenticates the browser by planting the session cookie the middleware and
 * API read. The token comes from the e2e stack (serve.ts prints it).
 */
/**
 * A user who has not acknowledged the latest announcement gets the What's New
 * dialog on first navigation; MUI hides the page behind it from the
 * accessibility tree, so assertions on page content must dismiss it first.
 */
export async function dismissWhatsNew(page: Page): Promise<void> {
  const acknowledge = page
    .getByRole('dialog')
    .getByRole('button', { name: /got it|close/i });
  try {
    await acknowledge.click({ timeout: 3000 });
  } catch {
    // Dialog never opened.
  }
}

export async function signIn(page: Page, token: string): Promise<void> {
  const { hostname } = new URL(BASE_URL);
  await page.context().addCookies([
    {
      name: 'session',
      value: token,
      domain: hostname,
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}
