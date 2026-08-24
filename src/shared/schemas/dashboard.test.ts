import { describe, expect, it } from 'vitest';
import { dashboardInsightsResponseSchema } from '@/shared/schemas/dashboard';

describe('dashboardInsightsResponseSchema', () => {
  it('accepts the shape the prompt asks the model for', () => {
    const parsed = dashboardInsightsResponseSchema.parse({
      unusualSpending: ['Groceries up 40%'],
      summary: 'Spending rose this month.',
    });

    expect(parsed.unusualSpending).toEqual(['Groceries up 40%']);
  });

  // The cast this replaced typed unusualSpending as string[] whatever came
  // back, so a bare string reached `.map` in AiInsightsCard and crashed it.
  it('rejects unusualSpending sent as a string instead of an array', () => {
    expect(() =>
      dashboardInsightsResponseSchema.parse({
        unusualSpending: 'Groceries up 40%',
        summary: 'Spending rose this month.',
      }),
    ).toThrow();
  });

  it('rejects a response missing summary', () => {
    expect(() =>
      dashboardInsightsResponseSchema.parse({ unusualSpending: [] }),
    ).toThrow();
  });
});
