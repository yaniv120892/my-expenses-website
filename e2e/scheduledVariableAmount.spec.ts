import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

const TOKEN = process.env.E2E_AUTH_TOKEN || '';
const PREFIX_FIELD = /bank description starts with/i;

test('a schedule keeps its bank description prefix, and a blank one clears it', async ({
  page,
}) => {
  test.skip(!TOKEN, 'E2E_AUTH_TOKEN not provided');
  const description = `e2e cloud storage ${Date.now()}`;

  await signIn(page, TOKEN);
  await page.goto('/scheduled');
  await page.getByRole('button', { name: /add scheduled/i }).click();
  const dialog = page.getByRole('dialog');
  await dialog
    .getByRole('textbox', { name: /^description/i })
    .fill(description);
  await dialog.getByRole('spinbutton', { name: /^value/i }).fill('8');
  await dialog.getByRole('textbox', { name: PREFIX_FIELD }).fill('GOOGLE');
  await dialog.getByRole('combobox', { name: 'Category' }).click();
  await page.getByRole('option').first().click();
  await dialog.getByRole('spinbutton', { name: /day of month/i }).fill('2');
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByText(description).click();
  const prefix = page.getByRole('dialog').getByRole('textbox', {
    name: PREFIX_FIELD,
  });
  await expect(prefix).toHaveValue('GOOGLE');

  await prefix.fill('');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Update' })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.getByText(description).click();
  await expect(
    page.getByRole('dialog').getByRole('textbox', { name: PREFIX_FIELD }),
  ).toHaveValue('');
});
