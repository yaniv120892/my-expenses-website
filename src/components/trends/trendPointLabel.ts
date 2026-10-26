import type { AppFormatter } from '@/i18n/useAppFormat';
import type { TrendPeriod } from '@/types/trends';

/** A daily point's key is a calendar day, which reads better as a localized date. */
export function trendPointLabel({
  date,
  period,
  formatter,
}: {
  date: string;
  period: TrendPeriod;
  formatter: AppFormatter;
}): string {
  if (period === 'daily') {
    return formatter.day(date);
  }
  return formatter.trendDate(date, period);
}
