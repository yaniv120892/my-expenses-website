import { describe, expect, it } from 'vitest';
import {
  findScheduleMatch,
  MatchableSchedule,
} from '@/server/utils/scheduleMatching';

const schedule = (
  over: Partial<MatchableSchedule> = {},
): MatchableSchedule => ({
  id: 'sched-1',
  description: 'Netflix',
  value: 49.9,
  scheduleType: 'MONTHLY',
  nextRunDate: new Date('2026-09-04T00:00:00Z'),
  ...over,
});

describe('findScheduleMatch', () => {
  it('prefers the schedule a conversion linked, whatever its name', () => {
    const match = findScheduleMatch(
      { merchantName: 'netflix', scheduledTransactionId: 'sched-9' },
      [schedule(), schedule({ id: 'sched-9', description: 'Renamed by user' })],
    );
    expect(match).toMatchObject({ id: 'sched-9', matchType: 'LINKED' });
  });

  it('falls back to a name match when the linked schedule is gone', () => {
    const match = findScheduleMatch(
      { merchantName: 'netflix', scheduledTransactionId: 'deleted' },
      [schedule()],
    );
    expect(match).toMatchObject({ id: 'sched-1', matchType: 'NAME_MATCH' });
  });

  it('matches a schedule whose description contains the merchant', () => {
    const match = findScheduleMatch({ merchantName: 'netflix' }, [
      schedule({ description: 'Netflix subscription' }),
    ]);
    expect(match?.matchType).toBe('NAME_MATCH');
  });

  it('matches when the merchant key is the longer of the two', () => {
    const match = findScheduleMatch({ merchantName: 'netflix premium' }, [
      schedule({ description: 'Netflix' }),
    ]);
    expect(match?.matchType).toBe('NAME_MATCH');
  });

  it('returns nothing for an unrelated schedule', () => {
    expect(
      findScheduleMatch({ merchantName: 'netflix' }, [
        schedule({ description: 'Gym membership' }),
      ]),
    ).toBeUndefined();
  });

  it('returns nothing when the user has no schedules', () => {
    expect(findScheduleMatch({ merchantName: 'netflix' }, [])).toBeUndefined();
  });

  it('carries the schedule details through for display', () => {
    const match = findScheduleMatch({ merchantName: 'netflix' }, [schedule()]);
    expect(match).toEqual({
      id: 'sched-1',
      description: 'Netflix',
      value: 49.9,
      scheduleType: 'MONTHLY',
      nextRunDate: new Date('2026-09-04T00:00:00Z'),
      matchType: 'NAME_MATCH',
    });
  });
});
