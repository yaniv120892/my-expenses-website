import { test, expect, Page } from '@playwright/test';
import { signIn } from './helpers';

const TOKEN = process.env.E2E_AUTH_TOKEN || '';

const BUCKET = process.env.IMPORTS_S3_BUCKET || 'e2e-imports';
const REGION = process.env.IMPORTS_S3_REGION || 'us-east-1';

/**
 * The upload endpoint is the only step that talks to S3, so it is fulfilled in
 * the browser and never reaches the server. Everything downstream — creating
 * the imports, submitting extraction to the mock agent, and the webhook that
 * completes them — runs for real.
 */
async function stubS3Upload(page: Page): Promise<void> {
  let uploadCount = 0;

  await page.route('**/api/imports/upload', async (route) => {
    uploadCount++;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        fileUrl: `https://${BUCKET}.s3.${REGION}.amazonaws.com/imports/e2e-${uploadCount}-statement.csv`,
      }),
    });
  });
}

/**
 * The mock agent reads the card digits out of the filename, and an import for
 * a card+month that already exists is merged into it and dropped. Fresh digits
 * per run therefore keep each test asserting on an import it actually created,
 * rather than on a leftover row from an earlier run.
 */
function uniqueCardFile(): { name: string; digits: string } {
  const digits = String(1000 + Math.floor(Math.random() * 9000));
  return { name: `card-${digits}_03_2026.csv`, digits };
}

function csvFile(name: string) {
  return {
    name,
    mimeType: 'text/csv',
    buffer: Buffer.from('date,description,amount\n07/03/2026,Coffee,12.5\n'),
  };
}

async function openUploadDialog(page: Page): Promise<void> {
  await page.goto('/imports');
  await expect(page.getByRole('heading', { name: 'Imports' })).toBeVisible();
  await page.getByRole('button', { name: 'Upload' }).click();
  await expect(
    page.getByRole('heading', { name: 'Import Files' }),
  ).toBeVisible();
}

/**
 * The seed truncates once per stack, not per test, so imports accumulate
 * across tests and reruns. Assertions target the row for a given file rather
 * than counting rows globally.
 */
function importRow(page: Page, fileName: string) {
  return page.getByRole('row').filter({ hasText: fileName }).first();
}

test.describe('multi-file imports', () => {
  test.skip(!TOKEN, 'E2E_AUTH_TOKEN not provided');

  test('each uploaded file becomes its own import', async ({ page }) => {
    await signIn(page, TOKEN);
    await stubS3Upload(page);
    await openUploadDialog(page);

    const first = uniqueCardFile();
    const second = uniqueCardFile();

    await page
      .locator('input[type="file"]')
      .setInputFiles([csvFile(first.name), csvFile(second.name)]);

    // Queued, not yet sent — the month is still editable at this point.
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText(first.name)).toBeVisible();
    await expect(dialog.getByText(second.name)).toBeVisible();

    await page.getByRole('button', { name: 'Upload 2 files' }).click();

    // The dialog closes itself once every file has been accepted.
    await expect(
      page.getByRole('heading', { name: 'Import Files' }),
    ).toBeHidden({ timeout: 30_000 });

    // Two independent imports, each carrying the card digits the mock agent
    // derived from its own filename — and reaching COMPLETED without a
    // reload, which only happens if the list is polling.
    for (const card of [first, second]) {
      const row = importRow(page, card.name);
      await expect(row).toBeVisible({ timeout: 30_000 });
      await expect(row.getByText(card.digits, { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await expect(row.getByText('COMPLETED')).toBeVisible({
        timeout: 30_000,
      });
    }
  });

  test('a rejected file fails on its own row and can be retried', async ({
    page,
  }) => {
    await signIn(page, TOKEN);

    let failNext = true;
    await page.route('**/api/imports/upload', async (route) => {
      if (failNext) {
        failNext = false;
        await route.fulfill({
          status: 400,
          contentType: 'text/plain',
          body: 'File is too large. Maximum size is 10MB',
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          fileUrl: `https://${BUCKET}.s3.${REGION}.amazonaws.com/imports/e2e-retry-statement.csv`,
        }),
      });
    });

    const card = uniqueCardFile();

    await openUploadDialog(page);
    await page
      .locator('input[type="file"]')
      .setInputFiles([csvFile(card.name)]);
    await page.getByRole('button', { name: 'Upload 1 file' }).click();

    // Exact, so this is the row's own error rather than the batch summary's
    // "<filename>: <error>" line.
    await expect(
      page.getByText('File is too large. Maximum size is 10MB', {
        exact: true,
      }),
    ).toBeVisible({ timeout: 30_000 });
    // The dialog stays open so the row can be retried.
    await expect(
      page.getByRole('heading', { name: 'Import Files' }),
    ).toBeVisible();

    await page.getByLabel(`Retry ${card.name}`).click();

    await expect(
      page.getByRole('heading', { name: 'Import Files' }),
    ).toBeHidden({ timeout: 30_000 });

    const row = importRow(page, card.name);
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row.getByText(card.digits, { exact: true })).toBeVisible({
      timeout: 30_000,
    });
  });
});
