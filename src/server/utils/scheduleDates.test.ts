import { describe, expect, it } from 'vitest';
import { ScheduleType } from '@prisma/client';
import { calculateNextRunDate } from '@/server/utils/scheduleDates';

const wedAug12 = new Date(2026, 7, 12, 15, 30, 45);

describe('calculateNextRunDate', () => {
  describe('DAILY', () => {
    it('defaults to a 1-day interval and returns start of day', () => {
      const result = calculateNextRunDate(
        ScheduleType.DAILY,
        undefined,
        wedAug12,
      );
      expect(result).toEqual(new Date(2026, 7, 13));
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });

    it('adds an explicit interval of days', () => {
      expect(calculateNextRunDate(ScheduleType.DAILY, 3, wedAug12)).toEqual(
        new Date(2026, 7, 15),
      );
    });

    it('rolls over a month boundary', () => {
      expect(
        calculateNextRunDate(ScheduleType.DAILY, 1, new Date(2026, 7, 31, 9)),
      ).toEqual(new Date(2026, 8, 1));
    });
  });

  describe('WEEKLY', () => {
    it('adds interval weeks when no dayOfWeek is given', () => {
      expect(
        calculateNextRunDate(ScheduleType.WEEKLY, undefined, wedAug12),
      ).toEqual(new Date(2026, 7, 19));
      expect(calculateNextRunDate(ScheduleType.WEEKLY, 2, wedAug12)).toEqual(
        new Date(2026, 7, 26),
      );
    });

    it('lands on the requested day within the next week (1-based dayOfWeek)', () => {
      expect(
        calculateNextRunDate(ScheduleType.WEEKLY, undefined, wedAug12, 6),
      ).toEqual(new Date(2026, 7, 21));
    });

    it('can land earlier in the next week than fromDate weekday', () => {
      const satAug15 = new Date(2026, 7, 15, 12);
      expect(
        calculateNextRunDate(ScheduleType.WEEKLY, undefined, satAug15, 1),
      ).toEqual(new Date(2026, 7, 16));
    });

    it('rolls over one more week when the target day is not after fromDate', () => {
      const satAug15 = new Date(2026, 7, 15);
      expect(
        calculateNextRunDate(ScheduleType.WEEKLY, undefined, satAug15, 0),
      ).toEqual(new Date(2026, 7, 22));
    });
  });

  describe('MONTHLY', () => {
    it('uses dayOfMonth in the current month when it is after fromDate', () => {
      expect(
        calculateNextRunDate(
          ScheduleType.MONTHLY,
          undefined,
          wedAug12,
          undefined,
          20,
        ),
      ).toEqual(new Date(2026, 7, 20));
    });

    it('moves to next month when dayOfMonth is not after fromDate', () => {
      expect(
        calculateNextRunDate(
          ScheduleType.MONTHLY,
          undefined,
          wedAug12,
          undefined,
          5,
        ),
      ).toEqual(new Date(2026, 8, 5));
      expect(
        calculateNextRunDate(
          ScheduleType.MONTHLY,
          undefined,
          wedAug12,
          undefined,
          12,
        ),
      ).toEqual(new Date(2026, 8, 12));
    });

    it('overflows into the next month when dayOfMonth 31 is set from a 30-day month', () => {
      const aprilFrom = new Date(2026, 3, 15, 8);
      expect(
        calculateNextRunDate(
          ScheduleType.MONTHLY,
          undefined,
          aprilFrom,
          undefined,
          31,
        ),
      ).toEqual(new Date(2026, 4, 1));
    });

    it('overflows past February when dayOfMonth 31 is applied to the clamped next month', () => {
      const jan31 = new Date(2026, 0, 31);
      expect(
        calculateNextRunDate(
          ScheduleType.MONTHLY,
          undefined,
          jan31,
          undefined,
          31,
        ),
      ).toEqual(new Date(2026, 2, 3));
    });

    it('adds interval months when no dayOfMonth is given, clamping month ends', () => {
      expect(calculateNextRunDate(ScheduleType.MONTHLY, 2, wedAug12)).toEqual(
        new Date(2026, 9, 12),
      );
      expect(
        calculateNextRunDate(
          ScheduleType.MONTHLY,
          undefined,
          new Date(2026, 0, 31),
        ),
      ).toEqual(new Date(2026, 1, 28));
    });
  });

  describe('YEARLY', () => {
    it('adds interval years', () => {
      expect(
        calculateNextRunDate(ScheduleType.YEARLY, undefined, wedAug12),
      ).toEqual(new Date(2027, 7, 12));
      expect(calculateNextRunDate(ScheduleType.YEARLY, 3, wedAug12)).toEqual(
        new Date(2029, 7, 12),
      );
    });
  });

  describe('CUSTOM', () => {
    it('adds interval days, defaulting to 1', () => {
      expect(calculateNextRunDate(ScheduleType.CUSTOM, 10, wedAug12)).toEqual(
        new Date(2026, 7, 22),
      );
      expect(
        calculateNextRunDate(ScheduleType.CUSTOM, undefined, wedAug12),
      ).toEqual(new Date(2026, 7, 13));
    });
  });
});
