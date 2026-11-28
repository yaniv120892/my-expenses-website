import { beforeEach, describe, expect, it, vi } from 'vitest';

const { analyzeExpenses, getValue, setValue } = vi.hoisted(() => ({
  analyzeExpenses: vi.fn(),
  getValue: vi.fn(),
  setValue: vi.fn(),
}));

vi.mock('@/server/redis', () => ({ getValue, setValue }));
vi.mock('@/server/services/ai/aiServiceFactory', () => ({
  default: { getAIService: () => ({ analyzeExpenses }) },
}));
vi.mock('@/server/repositories/dashboardRepository', () => ({
  default: {
    getMonthSummary: vi.fn(async () => ({
      month: '2026-10',
      totalIncome: 1000,
      totalExpense: 400,
      savings: 600,
    })),
    getTopCategoriesForMonth: vi.fn(async () => [
      { categoryId: 'category-1', categoryName: 'Food', amount: 400 },
    ]),
  },
}));

import dashboardService from './dashboardService';
import dashboardRepository from '@/server/repositories/dashboardRepository';
import { toHouseholdId } from '@/server/auth/householdId';

const HOUSEHOLD_ID = toHouseholdId('household-1');

const INSIGHTS = { unusualSpending: [], summary: 'ok' };

describe('dashboardService.getInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getValue.mockResolvedValue(null);
    analyzeExpenses.mockResolvedValue(JSON.stringify(INSIGHTS));
  });

  it.each([
    ['he', 'Hebrew'],
    ['en', 'English'],
  ] as const)('asks for %s insights and caches them per locale', async (locale, language) => {
    await expect(
      dashboardService.getInsights({ householdId: HOUSEHOLD_ID, locale }),
    ).resolves.toEqual(INSIGHTS);

    expect(analyzeExpenses.mock.calls[0]?.[0]).toContain(
      `Write every insight and the summary in ${language}`,
    );
    expect(getValue.mock.calls[0]?.[0]).toContain(`:${HOUSEHOLD_ID}:${locale}:`);
    expect(setValue.mock.calls[0]?.[0]).toContain(`:${HOUSEHOLD_ID}:${locale}:`);
    for (const [householdId] of vi.mocked(dashboardRepository.getMonthSummary).mock.calls) {
      expect(householdId).toBe(HOUSEHOLD_ID);
    }
    expect(dashboardRepository.getTopCategoriesForMonth).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      expect.any(Number),
      expect.any(Number),
      7,
    );
  });

  it('takes pretty-printed JSON that follows the explanation', async () => {
    const insights = { unusualSpending: ['Restaurants doubled'], summary: 'Spending rose.' };
    analyzeExpenses.mockResolvedValue(
      `There are two things worth noting this month.\n\n${JSON.stringify(insights, null, 2)}`,
    );

    await expect(
      dashboardService.getInsights({ householdId: HOUSEHOLD_ID, locale: 'en' }),
    ).resolves.toEqual(insights);
  });

  it('takes the JSON from the last line when the model explains first', async () => {
    const insights = { unusualSpending: ['Restaurants doubled'], summary: 'Spending rose.' };
    analyzeExpenses.mockResolvedValue(
      `There are two things worth noting this month.\nSpending rose.\n${JSON.stringify(insights)}`,
    );

    await expect(
      dashboardService.getInsights({ householdId: HOUSEHOLD_ID, locale: 'en' }),
    ).resolves.toEqual(insights);
  });

  it('still reads an answer that is only pretty-printed JSON', async () => {
    analyzeExpenses.mockResolvedValue(JSON.stringify(INSIGHTS, null, 2));

    await expect(
      dashboardService.getInsights({ householdId: HOUSEHOLD_ID, locale: 'en' }),
    ).resolves.toEqual(INSIGHTS);
  });

  it('falls back to no insights, uncached, when the answer holds no JSON', async () => {
    analyzeExpenses.mockResolvedValue('There are no unusual expenses this month.');

    await expect(
      dashboardService.getInsights({ householdId: HOUSEHOLD_ID, locale: 'en' }),
    ).resolves.toBeNull();
    expect(setValue).not.toHaveBeenCalled();
  });
});
