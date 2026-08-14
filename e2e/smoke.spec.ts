import { test, expect } from '@playwright/test';
import { signIn } from './helpers';
import { APP_PAGES } from './routes';

const TOKEN = process.env.E2E_AUTH_TOKEN || '';

test('unauthenticated visitor is redirected to login', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('login page renders', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
});

for (const { path, heading } of APP_PAGES) {
  test(`${path} renders for an authenticated user`, async ({ page }) => {
    test.skip(!TOKEN, 'E2E_AUTH_TOKEN not provided');

    await signIn(page, TOKEN);
    await page.goto(path);
    await expect(page).toHaveURL(path);
    await expect(
      page.getByRole('heading', { name: heading }).first(),
    ).toBeVisible();
  });
}
