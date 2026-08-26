import { describe, expect, it } from 'vitest';
import { normalizeDateRange } from '@/server/repositories/transactionRepository';

describe('normalizeDateRange', () => {
  it('floors startDate and widens endDate to the same day, whatever the time', () => {
    const moment = new Date('2026-08-25T21:14:09');

    const { startDate, endDate } = normalizeDateRange(moment, moment);

    expect(startDate).toEqual(new Date('2026-08-25T00:00:00.000'));
    expect(endDate).toEqual(new Date('2026-08-25T23:59:59.999'));
  });

  it('leaves absent bounds absent', () => {
    expect(normalizeDateRange(undefined, undefined)).toEqual({
      startDate: undefined,
      endDate: undefined,
    });
  });
});
