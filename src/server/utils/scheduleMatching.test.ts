import { describe, expect, it } from 'vitest';
import {
  findScheduleMatch,
  indexSchedules,
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

const findMatch = (
  subscription: { merchantName: string; scheduledTransactionId?: string },
  schedules: MatchableSchedule[],
) => findScheduleMatch(subscription, indexSchedules(schedules));

describe('findScheduleMatch', () => {
  it('prefers the schedule a conversion linked, whatever its name', () => {
    const match = findMatch(
      { merchantName: 'netflix', scheduledTransactionId: 'sched-9' },
      [schedule(), schedule({ id: 'sched-9', description: 'Renamed by user' })],
    );
    expect(match).toMatchObject({ id: 'sched-9', matchType: 'LINKED' });
  });

  it('falls back to a name match when the linked schedule is gone', () => {
    const match = findMatch(
      { merchantName: 'netflix', scheduledTransactionId: 'deleted' },
      [schedule()],
    );
    expect(match).toMatchObject({ id: 'sched-1', matchType: 'NAME_MATCH' });
  });

  it('matches a schedule whose description contains the merchant', () => {
    const match = findMatch({ merchantName: 'netflix' }, [
      schedule({ description: 'Netflix subscription' }),
    ]);
    expect(match?.matchType).toBe('NAME_MATCH');
  });

  it('matches when the merchant key is the longer of the two', () => {
    const match = findMatch({ merchantName: 'netflix premium' }, [
      schedule({ description: 'Netflix' }),
    ]);
    expect(match?.matchType).toBe('NAME_MATCH');
  });

  it('returns nothing for an unrelated schedule', () => {
    expect(
      findMatch({ merchantName: 'netflix' }, [
        schedule({ description: 'Gym membership' }),
      ]),
    ).toBeUndefined();
  });

  it('returns nothing when the user has no schedules', () => {
    expect(findMatch({ merchantName: 'netflix' }, [])).toBeUndefined();
  });

  it('carries the schedule details through for display', () => {
    const match = findMatch({ merchantName: 'netflix' }, [schedule()]);
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
