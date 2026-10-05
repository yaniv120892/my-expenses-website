import { test, expect, Page } from '@playwright/test';
import { signIn } from './helpers';

const TOKEN = process.env.E2E_AUTH_TOKEN || '';

const BUCKET = process.env.IMPORTS_S3_BUCKET || 'e2e-imports';
const REGION = process.env.IMPORTS_S3_REGION || 'us-east-1';

// Only the S3 upload is fulfilled in the browser; creating the imports,
// extraction and the completing webhook all run for real.
async function stubS3Upload(page: Page, failFirst = false): Promise<void> {
  let uploadCount = 0;
  let shouldFail = failFirst;

  await page.route('**/api/imports/upload', async (route) => {
    if (shouldFail) {
      shouldFail = false;
      await route.fulfill({
        status: 400,
        contentType: 'text/plain',
        body: 'File is too large. Maximum size is 10MB',
      });
      return;
    }

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

// The mock agent reads the card digits from the filename and merges a repeated
// card+month away, so fresh digits keep each test on an import it created.
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

// The seed truncates once per stack, so imports accumulate across tests.
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

    await expect(
      page.getByRole('heading', { name: 'Import Files' }),
    ).toBeHidden({ timeout: 30_000 });

    // Reaching COMPLETED without a reload proves the list is polling.
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
    await stubS3Upload(page, true);

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
