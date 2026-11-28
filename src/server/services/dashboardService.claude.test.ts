import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ClientOptions } from '@anthropic-ai/sdk';
import type * as AnthropicModule from '@anthropic-ai/sdk';

const { anthropicFetch } = vi.hoisted(() => ({ anthropicFetch: vi.fn() }));

vi.mock('@anthropic-ai/sdk', async (importOriginal) => {
  const actual = await importOriginal<typeof AnthropicModule>();
  class RecordingAnthropic extends actual.default {
    public constructor(options: ClientOptions) {
      super({ ...options, fetch: anthropicFetch });
    }
  }
  return { ...actual, default: RecordingAnthropic };
});
vi.mock('@/server/redis', () => ({ getValue: vi.fn(async () => null), setValue: vi.fn() }));
vi.mock('@/server/repositories/dashboardRepository', () => ({
  default: {
    getMonthSummary: vi.fn(async () => ({
      month: '2026-11',
      totalIncome: 18500,
      totalExpense: 14230,
      savings: 4270,
    })),
    getTopCategoriesForMonth: vi.fn(async () => [
      { categoryId: 'category-1', categoryName: 'Restaurants', amount: 2450 },
    ]),
  },
}));

import dashboardService from './dashboardService';
import { toHouseholdId } from '@/server/auth/householdId';

const INSIGHTS = { unusualSpending: ['Restaurants doubled'], summary: 'Spending rose.' };

function sentRequestBody(): { system?: unknown; messages: { content: string }[] } {
  const [, init] = anthropicFetch.mock.calls[0] ?? [];
  return JSON.parse(String(init?.body));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('AI_PROVIDER', 'claude');
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  anthropicFetch.mockResolvedValue(
    Response.json({
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-sonnet-5-5',
      content: [{ type: 'text', text: JSON.stringify(INSIGHTS) }],
      stop_reason: 'end_turn',
      stop_details: null,
      usage: { input_tokens: 120, output_tokens: 40 },
    }),
  );
});

describe('dashboard AI insights on Claude', () => {
  it('sends the insights prompt as written, without the short-prose analysis instructions', async () => {
    await expect(
      dashboardService.getInsights({ householdId: toHouseholdId('household-1'), locale: 'he' }),
    ).resolves.toEqual(INSIGHTS);

    const body = sentRequestBody();
    const [message] = body.messages;
    expect(message?.content).toMatch(/^Analyze these monthly expenses and provide insights\./);
    expect(message?.content).toMatch(/"summary": "A brief overall summary"}$/);
    expect(message?.content).not.toContain('no more than 2 sentences');
    expect(body).not.toHaveProperty('system');
  });
});
