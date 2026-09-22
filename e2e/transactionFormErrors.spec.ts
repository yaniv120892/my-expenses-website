import { test, expect, Page } from '@playwright/test';
import { signIn } from './helpers';

const TOKEN = process.env.E2E_AUTH_TOKEN || '';

async function fillCreateForm(page: Page) {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /add transaction/i }).click();
  await page.getByRole('textbox', { name: /description/i }).fill('Form error');
  await page.getByRole('spinbutton', { name: /value/i }).fill('42');
  // A chosen category keeps the save off the AI categorization path.
  await page.getByRole('combobox', { name: 'Category' }).click();
  await page.getByRole('option').first().click();
}

test('a rejected save reports the failure and keeps the dialog open', async ({
  page,
}) => {
  test.skip(!TOKEN, 'E2E_AUTH_TOKEN not provided');

  await signIn(page, TOKEN);
  await page.route('**/api/transactions', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Category not found' }),
      });
      return;
    }
    await route.fallback();
  });

  await fillCreateForm(page);
  await page.getByRole('button', { name: 'Create' }).click();

  // getByText rather than getByRole('alert'): while the dialog is open MUI's
  // focus trap aria-hides the snackbar, so role queries skip it.
  await expect(page.getByText('Category not found')).toBeVisible();
  await expect(page.getByText(/created successfully/i)).toHaveCount(0);
  await expect(page.getByRole('dialog')).toHaveCount(1);
});

test('an accepted save reports success and closes', async ({ page }) => {
  test.skip(!TOKEN, 'E2E_AUTH_TOKEN not provided');

  await signIn(page, TOKEN);
  await fillCreateForm(page);
  await page.getByRole('button', { name: 'Create' }).click();

  await expect(
    page.getByText('Transaction created successfully'),
  ).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
