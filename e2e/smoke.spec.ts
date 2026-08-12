import { test, expect } from '@playwright/test';
import { dismissWhatsNew, signIn } from './helpers';

const TOKEN = process.env.E2E_AUTH_TOKEN || '';

const PAGES = [
  { path: '/dashboard', heading: 'Dashboard' },
  { path: '/transactions', heading: 'Transactions' },
  { path: '/pending', heading: /pending/i },
  { path: '/scheduled', heading: /scheduled/i },
  { path: '/subscriptions', heading: 'Subscriptions' },
  { path: '/imports', heading: 'Imports' },
  { path: '/trends', heading: 'Trends' },
  { path: '/settings', heading: 'Settings' },
];

test('unauthenticated visitor is redirected to login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('login page renders', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
});

for (const { path, heading } of PAGES) {
  test(`${path} renders for an authenticated user`, async ({ page }) => {
    test.skip(!TOKEN, 'E2E_AUTH_TOKEN not provided');

    await signIn(page, TOKEN);
    await page.goto(path);
    await expect(page).toHaveURL(path);
    await dismissWhatsNew(page);
    await expect(
      page.getByRole('heading', { name: heading }).first(),
    ).toBeVisible();
  });
}
