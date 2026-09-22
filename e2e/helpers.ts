import { Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

// The token comes from the e2e stack (serve.ts prints it).
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
