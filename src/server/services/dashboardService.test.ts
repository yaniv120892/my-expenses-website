import { beforeEach, describe, expect, it, vi } from 'vitest';

const { generateContent, getValue, setValue } = vi.hoisted(() => ({
  generateContent: vi.fn(),
  getValue: vi.fn(),
  setValue: vi.fn(),
}));

vi.mock('@/server/redis', () => ({ getValue, setValue }));
vi.mock('@/server/services/ai/aiServiceFactory', () => ({
  default: { getAIService: () => ({ generateContent }) },
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
import { logger } from '@/server/observability';
import dashboardRepository from '@/server/repositories/dashboardRepository';
import { toHouseholdId } from '@/server/auth/householdId';

const HOUSEHOLD_ID = toHouseholdId('household-1');

const INSIGHTS = { unusualSpending: ['Restaurants doubled'], summary: 'Spending rose.' };

describe('dashboardService.getInsights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getValue.mockResolvedValue(null);
    generateContent.mockResolvedValue(JSON.stringify(INSIGHTS));
  });

  it.each([
    ['he', 'Hebrew'],
    ['en', 'English'],
  ] as const)('asks for %s insights and caches them per locale', async (locale, language) => {
    await expect(
      dashboardService.getInsights({ householdId: HOUSEHOLD_ID, locale }),
    ).resolves.toEqual(INSIGHTS);

    expect(generateContent.mock.calls[0]?.[0]).toContain(
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

  it.each([
    [
      'pretty-printed JSON after an explanation',
      `There are two things worth noting.\n\n${JSON.stringify(INSIGHTS, null, 2)}`,
    ],
    [
      'JSON after an explanation on the same line',
      `There are two things: ${JSON.stringify(INSIGHTS)}`,
    ],
    [
      'JSON on the last line after an explanation',
      `There are two things.\nSpending rose.\n${JSON.stringify(INSIGHTS)}`,
    ],
    ['only pretty-printed JSON', JSON.stringify(INSIGHTS, null, 2)],
  ])('reads the insights from %s', async (_shape, answer) => {
    generateContent.mockResolvedValue(answer);

    await expect(
      dashboardService.getInsights({ householdId: HOUSEHOLD_ID, locale: 'en' }),
    ).resolves.toEqual(INSIGHTS);
  });

  it('falls back to no insights, uncached, when the answer holds no JSON', async () => {
    const loggedError = vi.spyOn(logger, 'error');
    generateContent.mockResolvedValue('There are no unusual expenses this month.');

    await expect(
      dashboardService.getInsights({ householdId: HOUSEHOLD_ID, locale: 'en' }),
    ).resolves.toBeNull();
    expect(setValue).not.toHaveBeenCalled();
    expect(loggedError).toHaveBeenCalledWith(
      { answerLength: expect.any(Number) },
      'Failed to parse AI insights response',
    );
  });
});
