import { test, expect, Route } from '@playwright/test';
import { signIn } from './helpers';

const TOKEN = process.env.E2E_AUTH_TOKEN || '';

const RENT_ID = '11111111-1111-4111-8111-111111111111';
const TRANSPORT_ID = '22222222-2222-4222-8222-222222222222';

const CATEGORIES = [
  { id: RENT_ID, name: 'Rent', parentId: null },
  { id: TRANSPORT_ID, name: 'Transport', parentId: null },
];

const BREAKDOWN = [
  { categoryId: RENT_ID, categoryName: 'Rent', amount: 900, percentage: 90 },
  {
    categoryId: TRANSPORT_ID,
    categoryName: 'Transport',
    amount: 100,
    percentage: 10,
  },
];

const SUMMARY = {
  totalIncome: 3000,
  totalExpense: 1000,
  count: 3,
  incomeCount: 1,
  expenseCount: 2,
};

const TRANSPORT_ROW = {
  id: '33333333-3333-4333-8333-333333333333',
  description: 'Bus pass',
  value: 100,
  date: new Date().toISOString(),
  type: 'EXPENSE',
  status: 'APPROVED',
  category: { id: TRANSPORT_ID, name: 'Transport' },
};

// Mocked so the shares and rows are fixed: this spec covers how the page wires
// the two charts to its filters, the endpoint has its own e2e-api checks.
test('the expense slice opens a category split whose slices filter the list', async ({
  page,
}) => {
  test.skip(!TOKEN, 'E2E_AUTH_TOKEN not provided');

  const listRequests: URLSearchParams[] = [];
  const breakdownRequests: URLSearchParams[] = [];
  const lastListFilter = () => {
    const params = listRequests.at(-1);
    return `${params?.get('type')}|${params?.get('categoryId') ?? 'none'}`;
  };
  await signIn(page, TOKEN);
  await page.route('**/api/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const isGet = route.request().method() === 'GET';
    switch (isGet ? url.pathname : '') {
      case '/api/categories':
        return route.fulfill({ json: CATEGORIES });
      case '/api/transactions/summary':
        return route.fulfill({ json: SUMMARY });
      case '/api/transactions/summary/categories':
        breakdownRequests.push(url.searchParams);
        return route.fulfill({ json: BREAKDOWN });
      case '/api/transactions':
        listRequests.push(url.searchParams);
        return route.fulfill({
          json: {
            items:
              url.searchParams.get('categoryId') === TRANSPORT_ID
                ? [TRANSPORT_ROW]
                : [],
            nextCursor: null,
          },
        });
      default:
        return route.fallback();
    }
  });

  await page.goto('/transactions');
  await expect(
    page.getByRole('heading', { name: 'Expenses by category' }),
  ).toHaveCount(0);

  // Income is the first sector, Expense the second.
  await page.locator('.recharts-pie-sector').nth(1).click();
  await expect(
    page.getByRole('heading', { name: 'Expenses by category' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: /Rent.*90\.0%/ }),
  ).toBeVisible();

  await page.getByRole('button', { name: /Transport.*10\.0%/ }).click();
  await expect(page.getByText('Category: Transport')).toBeVisible();
  await expect(page.getByText('Bus pass')).toBeVisible();
  await expect.poll(() => lastListFilter()).toBe(`EXPENSE|${TRANSPORT_ID}`);
  expect(breakdownRequests.length).toBeGreaterThan(0);
  expect(breakdownRequests.every((params) => !params.has('categoryId'))).toBe(
    true,
  );

  // An expense category means nothing under Income, so switching type drops it.
  // Income spans 270°, so its box's centre is the donut hole; aim at the ring's
  // bottom, which Income covers.
  const incomeSector = page.locator('.recharts-pie-sector').first();
  const incomeBox = await incomeSector.boundingBox();
  await incomeSector.click({
    position: {
      x: (incomeBox?.width ?? 0) / 2,
      y: (incomeBox?.height ?? 0) - 12,
    },
  });
  await expect(
    page.getByRole('heading', { name: 'Income by category' }),
  ).toBeVisible();
  await expect(page.getByText('Category: Transport')).toHaveCount(0);
  await expect.poll(() => lastListFilter()).toBe('INCOME|none');
});
