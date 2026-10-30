import type { Browser, Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import { HOUSEHOLD_E2E_USERS, SEED_PASSWORD } from '../test/e2e-api/householdUsers';

type HouseholdUser = (typeof HOUSEHOLD_E2E_USERS)[keyof typeof HOUSEHOLD_E2E_USERS];

const SHARED_ROW = `Household shared ${Date.now()}`;
const EDITED_ROW = `${SHARED_ROW} edited`;

// The scenarios build on each other — the editor joins on the owner's invite,
// the owner later removes them — so they run in order, once, against the
// seed's data-free household users.
test.describe.configure({ mode: 'serial', retries: 0 });

test.describe('household sharing', () => {
  let browser: Browser;
  let owner: Page;
  let editor: Page;
  let viewer: Page;

  test.beforeAll(async ({ browser: sharedBrowser }) => {
    browser = sharedBrowser;
  });

  test('1. the owner records a transaction and creates an editor invite', async () => {
    owner = await signedInPage(HOUSEHOLD_E2E_USERS.owner);
    await addTransaction(owner, SHARED_ROW);

    const editorInvite = await createInvite(owner, 'Editor');
    editor = await joinThroughInvite({
      user: HOUSEHOLD_E2E_USERS.editor,
      inviteLink: editorInvite,
      role: 'Editor',
    });

    await owner.goto('/settings');
    await expect(
      owner.getByTestId(`household-member-${HOUSEHOLD_E2E_USERS.editor.username}`),
    ).toBeVisible();
  });

  test('2. the invited user signed in through the link and is now a member', async () => {
    await editor.goto('/settings');
    await expect(
      editor.getByText(
        `You are a member of ${HOUSEHOLD_E2E_USERS.owner.username}'s household, as Editor.`,
      ),
    ).toBeVisible();
  });

  test('3. the editor edits the owner row; the owner sees the edit, who made it, and its activity record', async () => {
    await editor.goto('/transactions');
    await editor.getByText(SHARED_ROW, { exact: true }).click();
    await editor.getByRole('textbox', { name: /description/i }).fill(EDITED_ROW);
    await editor.getByRole('button', { name: /^(save|update)$/i }).click();
    await expect(editor.getByRole('dialog')).toHaveCount(0);

    await owner.goto('/transactions');
    await expect(owner.getByText(EDITED_ROW, { exact: true })).toBeVisible();
    await expect(
      owner.getByRole('row').filter({ hasText: EDITED_ROW }).getByTestId('transaction-attribution'),
    ).toHaveText(
      `Added by ${HOUSEHOLD_E2E_USERS.owner.username} · Edited by ${HOUSEHOLD_E2E_USERS.editor.username}`,
    );

    await owner.goto('/settings/activity');
    const editRecord = owner
      .getByTestId('household-activity-item')
      .filter({ hasText: EDITED_ROW })
      .filter({ hasText: 'edited a transaction' });
    await expect(editRecord).toContainText(HOUSEHOLD_E2E_USERS.editor.username);
  });

  test('4. a viewer sees the data but cannot write, in the UI or the API', async () => {
    const viewerInvite = await createInvite(owner, 'Viewer');
    viewer = await joinThroughInvite({
      user: HOUSEHOLD_E2E_USERS.viewer,
      inviteLink: viewerInvite,
      role: 'Viewer',
    });

    await viewer.goto('/transactions');
    await expect(viewer.getByText(EDITED_ROW, { exact: true })).toBeVisible();
    await expect(viewer.getByRole('button', { name: /add transaction/i })).toHaveCount(0);

    const categories: { id: string }[] = await (await viewer.request.get('/api/categories')).json();
    const refused = await viewer.request.post('/api/transactions', {
      data: {
        description: 'Viewer write',
        value: 5,
        type: 'EXPENSE',
        categoryId: categories[0]?.id,
        date: new Date().toISOString(),
      },
    });
    expect(refused.status(), await refused.text()).toBe(403);
    const transactions = await listTransactionDescriptions(viewer);
    expect(transactions).not.toContain('Viewer write');
  });

  test('4b. the owner copies a pending invite link, and revokes it only after confirming', async () => {
    await owner.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const pendingLink = await createInvite(owner, 'Viewer');

    await owner.reload();
    await owner.getByRole('button', { name: 'Copy link', exact: true }).click();
    await expect(owner.getByRole('button', { name: 'Copied', exact: true })).toBeVisible();
    expect(await owner.evaluate(() => navigator.clipboard.readText())).toBe(pendingLink);

    await owner.getByRole('button', { name: 'Revoke invite', exact: true }).click();
    const confirmation = owner.getByRole('dialog');
    await expect(confirmation).toContainText('The link stops working');
    await confirmation.getByRole('button', { name: 'Revoke invite', exact: true }).click();
    await expect(owner.getByRole('heading', { name: 'Pending invites' })).toHaveCount(0);

    const household = await owner.request.get('/api/household');
    expect((await household.json()).invites).toEqual([]);
  });

  test('5. once removed, the editor no longer sees the household data', async () => {
    await owner.goto('/settings');
    await owner
      .getByRole('button', { name: `Remove ${HOUSEHOLD_E2E_USERS.editor.username}` })
      .click();
    await owner.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
    await expect(
      owner.getByTestId(`household-member-${HOUSEHOLD_E2E_USERS.editor.username}`),
    ).toHaveCount(0);

    const afterRemoval = await editor.request.get('/api/transactions');
    expect(afterRemoval.status()).toBe(401);

    await editor.context().close();
    editor = await signedInPage(HOUSEHOLD_E2E_USERS.editor);
    expect(await listTransactionDescriptions(editor)).not.toContain(EDITED_ROW);
    await editor.goto('/transactions');
    await expect(editor.getByText(EDITED_ROW, { exact: true })).toHaveCount(0);
  });

  test('6. an unrelated user sees none of it', async () => {
    const outsider = await signedInPage(HOUSEHOLD_E2E_USERS.outsider);

    expect(await listTransactionDescriptions(outsider)).not.toContain(EDITED_ROW);
    await outsider.goto('/transactions');
    await expect(outsider.getByText(EDITED_ROW, { exact: true })).toHaveCount(0);

    const household = await outsider.request.get('/api/household');
    const members: { username: string }[] = (await household.json()).members;
    expect(members.map((member) => member.username)).toEqual([
      HOUSEHOLD_E2E_USERS.outsider.username,
    ]);
  });

  async function signedInPage(user: HouseholdUser): Promise<Page> {
    const page = await (await browser.newContext()).newPage();
    await page.goto('/login');
    await submitLogin(page, user);
    await expect(page).toHaveURL(/\/dashboard/);
    return page;
  }

  async function joinThroughInvite({
    user,
    inviteLink,
    role,
  }: {
    user: HouseholdUser;
    inviteLink: string;
    role: string;
  }): Promise<Page> {
    const page = await (await browser.newContext()).newPage();
    await page.goto(inviteLink);
    await expect(page).toHaveURL(/\/login\?next=/);
    await submitLogin(page, user);

    await expect(page).toHaveURL(/\/join\?code=/);
    await expect(
      page.getByText(`Join ${HOUSEHOLD_E2E_USERS.owner.username}'s household as ${role}.`),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Join', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    return page;
  }
});

async function submitLogin(page: Page, user: HouseholdUser): Promise<void> {
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(SEED_PASSWORD);
  await page.getByRole('button', { name: /^log in$/i }).click();
}

async function addTransaction(page: Page, description: string): Promise<void> {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /add transaction/i }).click();
  await page.getByRole('textbox', { name: /description/i }).fill(description);
  await page.getByRole('spinbutton', { name: /value/i }).fill('42');
  await page.getByRole('combobox', { name: 'Category' }).click();
  await page.getByRole('option').first().click();
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Transaction created successfully')).toBeVisible();
}

async function createInvite(page: Page, role: 'Editor' | 'Viewer'): Promise<string> {
  await page.goto('/settings');
  await page.getByRole('combobox', { name: 'They join as' }).click();
  await page.getByRole('option', { name: role, exact: true }).click();
  await page.getByRole('button', { name: 'Create invite link' }).click();
  const link = await page.getByLabel('Invite link', { exact: true }).textContent();
  expect(link).toMatch(/\/join\?code=[0-9A-Z]{8}$/);
  return link ?? '';
}

async function listTransactionDescriptions(page: Page): Promise<string[]> {
  const response = await page.request.get('/api/transactions');
  expect(response.status()).toBe(200);
  const body: { items: { description: string }[] } = await response.json();
  return body.items.map((row) => row.description);
}
