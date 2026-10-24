import { chromium } from '@playwright/test';
import { signIn } from './e2e/helpers';

const BASE_URL = 'http://127.0.0.1:3000';
const OUT = process.argv[2];
const big = {
  name: 'big-4.2mb.xlsx',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  buffer: Buffer.alloc(4200 * 1024),
};
const bigPdf = {
  name: 'scan-4.2mb.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.alloc(4200 * 1024),
};

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    baseURL: BASE_URL,
  });
  await signIn(page, process.env.E2E_AUTH_TOKEN ?? '');
  await page.goto('/imports');
  await page.getByRole('button', { name: 'Upload' }).click();
  await page.getByRole('heading', { name: 'Import Files' }).waitFor();
  await page.locator('input[type="file"]').setInputFiles([big]);
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: `${OUT}/import-upload-over-limit-desktop.png`,
  });

  await page.goto('/transactions');
  await page.getByRole('button', { name: 'Add transaction' }).first().click();
  await page
    .getByText(/^Attachments/)
    .first()
    .click();
  await page.locator('input[type="file"]').last().setInputFiles([bigPdf]);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/attachment-over-limit-desktop.png` });
  await browser.close();
}
void main();
