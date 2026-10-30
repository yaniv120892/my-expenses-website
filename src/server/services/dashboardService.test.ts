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
});
