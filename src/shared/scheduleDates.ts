import {
  addDays,
  addWeeks,
  addMonths,
  addYears,
  setDay,
  setDate,
  getDaysInMonth,
  isAfter,
  startOfDay,
} from 'date-fns';
import type { ScheduleType } from '@/generated/prisma/enums';

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
      if (dayOfWeek === undefined) {
        return startOfDay(addWeeks(fromDate, intervalValue));
      }
      const zeroBasedDayOfWeek = dayOfWeek - 1;
      const thisWeek = setDay(fromDate, zeroBasedDayOfWeek, {
        weekStartsOn: 0,
      });
      return startOfDay(
        isAfter(thisWeek, fromDate)
          ? thisWeek
          : addWeeks(thisWeek, intervalValue),
      );
    }
    case 'MONTHLY': {
      if (dayOfMonth === undefined) {
        return startOfDay(addMonths(fromDate, intervalValue));
      }
      const thisMonth = onDayOfMonth(fromDate, dayOfMonth);
      if (isAfter(thisMonth, fromDate)) {
        return startOfDay(thisMonth);
      }
      return startOfDay(
        onDayOfMonth(addMonths(fromDate, intervalValue), dayOfMonth),
      );
    }
    case 'YEARLY':
      return startOfDay(addYears(fromDate, intervalValue));
    case 'CUSTOM':
      return startOfDay(addDays(fromDate, intervalValue));
    default:
      return startOfDay(addDays(fromDate, 1));
  }
}

// A day past the month's end falls on its last day, so a schedule for the 31st
// runs on February 28th rather than skipping February for March 3rd.
function onDayOfMonth(date: Date, dayOfMonth: number): Date {
  return setDate(date, Math.min(dayOfMonth, getDaysInMonth(date)));
}
