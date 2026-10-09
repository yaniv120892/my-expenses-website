import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

const TOKEN = process.env.E2E_AUTH_TOKEN || '';

test('an API token is shown once, then revoked through the dialog', async ({
  page,
}) => {
  test.skip(!TOKEN, 'E2E_AUTH_TOKEN not provided');
  const name = `e2e token ${Date.now()}`;

  await signIn(page, TOKEN);
  await page.goto('/settings');
  await page.getByLabel('Token name').fill(name);
  await page.getByRole('checkbox', { name: /Imports/ }).check();
  await page.getByRole('button', { name: 'Create' }).click();

  const plaintext = page.getByText(/^mxk_/);
  await expect(plaintext).toBeVisible();
  const row = page.getByRole('row', { name: new RegExp(name) });
  await expect(row).toBeVisible();
  await expect(row.getByText('Imports')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible();
  await expect(page.getByText(/^mxk_/)).toHaveCount(0);

  await page.getByRole('button', { name: `Revoke ${name}` }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText(name);
  await dialog.getByRole('button', { name: 'Revoke' }).click();

  await expect(page.getByRole('row', { name: new RegExp(name) })).toHaveCount(
    0,
  );
});
