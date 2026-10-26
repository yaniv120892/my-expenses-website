import type { useFormat } from '@yaniv120892/my-ui';
import type { ScheduleType } from '@/types';

export type Format = ReturnType<typeof useFormat>;

export type DisplayedAmount = {
  value: number | null;
  currency: string | null;
  originalAmount: number;
};

export type ScheduleSummaryInput = {
  scheduleType: ScheduleType;
  interval?: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
};
