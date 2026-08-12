import { describe, expect, it } from 'vitest';
import { classifyTrend } from '@/server/utils/trendMath';

describe('classifyTrend', () => {
  it('computes percentage change against the previous value', () => {
    expect(classifyTrend(150, 100)).toEqual({ percentage: 50, trend: 'up' });
    expect(classifyTrend(50, 100)).toEqual({ percentage: -50, trend: 'down' });
  });

  it('reports zero and stable when previous is zero, even with a nonzero current', () => {
    expect(classifyTrend(0, 0)).toEqual({ percentage: 0, trend: 'stable' });
    expect(classifyTrend(100, 0)).toEqual({ percentage: 0, trend: 'stable' });
    expect(classifyTrend(-100, 0)).toEqual({ percentage: 0, trend: 'stable' });
  });

  it('treats changes within the +/-5 percent band as stable, boundaries inclusive', () => {
    expect(classifyTrend(105, 100).trend).toBe('stable');
    expect(classifyTrend(95, 100).trend).toBe('stable');
    expect(classifyTrend(100, 100)).toEqual({ percentage: 0, trend: 'stable' });
  });

  it('classifies just outside the band as up or down', () => {
    expect(classifyTrend(105.01, 100).trend).toBe('up');
    expect(classifyTrend(94.99, 100).trend).toBe('down');
  });

  it('handles a drop to zero and negative baselines', () => {
    expect(classifyTrend(0, 200)).toEqual({ percentage: -100, trend: 'down' });
    expect(classifyTrend(-50, -100)).toEqual({
      percentage: -50,
      trend: 'down',
    });
  });
});
