export type TrendDirection = 'up' | 'down' | 'stable';

export function classifyTrend(
  current: number,
  previous: number,
): { percentage: number; trend: TrendDirection } {
  const percentage =
    previous === 0 ? 0 : ((current - previous) / previous) * 100;
  let trend: TrendDirection = 'stable';
  if (percentage > 5) {
    trend = 'up';
  } else if (percentage < -5) {
    trend = 'down';
  }
  return { percentage, trend };
}
