import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  setDay,
  setDate,
  isAfter,
  startOfDay,
} from 'date-fns';
import { ScheduleType } from '@prisma/client';

export function calculateNextRunDate(
  scheduleType: ScheduleType,
  interval: number | undefined,
  fromDate: Date,
  dayOfWeek?: number,
  dayOfMonth?: number,
): Date {
  const intervalValue = interval || 1;
  switch (scheduleType) {
    case 'DAILY':
      return startOfDay(addDays(fromDate, intervalValue));
    case 'WEEKLY': {
      const baseDate = addWeeks(fromDate, intervalValue);
      if (dayOfWeek !== undefined) {
        // Adjust dayOfWeek to account for Sunday as start of week (0-based)
        const adjustedDayOfWeek = dayOfWeek - 1;
        let next = setDay(baseDate, adjustedDayOfWeek, { weekStartsOn: 0 });
        if (!isAfter(next, fromDate)) {
          next = addWeeks(next, 1);
        }
        return startOfDay(next);
      }
      return startOfDay(baseDate);
    }
    case 'MONTHLY': {
      if (dayOfMonth !== undefined) {
        const currentMonthDate = setDate(new Date(fromDate), dayOfMonth);
        if (isAfter(currentMonthDate, fromDate)) {
          return startOfDay(currentMonthDate);
        }
        const nextMonth = addMonths(fromDate, intervalValue);
        return startOfDay(setDate(nextMonth, dayOfMonth));
      }
      return startOfDay(addMonths(fromDate, intervalValue));
    }
    case 'YEARLY':
      return startOfDay(addYears(fromDate, intervalValue));
    case 'CUSTOM':
      return startOfDay(addDays(fromDate, intervalValue));
    default:
      return startOfDay(addDays(fromDate, 1));
  }
}
