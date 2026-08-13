import { describe, expect, it } from 'vitest';
import { bucketKeyFor, enumerateBuckets } from '@/server/utils/periodBuckets';

describe('bucketKeyFor', () => {
  it('formats each period', () => {
    const date = new Date(2026, 2, 9);
    expect(bucketKeyFor(date, 'daily')).toBe('2026-03-09');
    expect(bucketKeyFor(date, 'weekly')).toBe('2026-11');
    expect(bucketKeyFor(date, 'monthly')).toBe('2026-03');
    expect(bucketKeyFor(date, 'yearly')).toBe('2026');
  });

  it('falls back to daily format for unknown periods', () => {
    expect(bucketKeyFor(new Date(2026, 0, 5), 'quarterly')).toBe('2026-01-05');
  });

  it('uses the ISO week-year across calendar year boundaries', () => {
    expect(bucketKeyFor(new Date(2025, 11, 29), 'weekly')).toBe('2026-01');
    expect(bucketKeyFor(new Date(2025, 11, 28), 'weekly')).toBe('2025-52');
    expect(bucketKeyFor(new Date(2027, 0, 1), 'weekly')).toBe('2026-53');
  });
});

describe('enumerateBuckets', () => {
  it('returns empty when start is after end', () => {
    expect(
      enumerateBuckets(new Date(2026, 0, 2), new Date(2026, 0, 1), 'daily'),
    ).toEqual([]);
  });

  it('returns a single bucket when start equals end', () => {
    const day = new Date(2026, 4, 20);
    const buckets = enumerateBuckets(day, day, 'daily');
    expect(buckets).toHaveLength(1);
    expect(buckets[0].key).toBe('2026-05-20');
    expect(buckets[0].startDate).toEqual(day);
  });

  it('enumerates days across a month boundary', () => {
    const keys = enumerateBuckets(
      new Date(2026, 0, 30),
      new Date(2026, 1, 2),
      'daily',
    ).map((b) => b.key);
    expect(keys).toEqual([
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ]);
  });

  it('includes leap day when enumerating days in a leap February', () => {
    const keys = enumerateBuckets(
      new Date(2024, 1, 28),
      new Date(2024, 2, 1),
      'daily',
    ).map((b) => b.key);
    expect(keys).toEqual(['2024-02-28', '2024-02-29', '2024-03-01']);
  });

  it('enumerates ISO weeks across a year boundary without key collisions', () => {
    const buckets = enumerateBuckets(
      new Date(2025, 11, 25),
      new Date(2026, 0, 5),
      'weekly',
    );
    expect(buckets.map((b) => b.key)).toEqual([
      '2025-52',
      '2026-01',
      '2026-02',
    ]);
    expect(buckets[0].startDate).toEqual(new Date(2025, 11, 22));
    expect(buckets[1].startDate).toEqual(new Date(2025, 11, 29));
  });

  it('starts weekly buckets on Mondays, possibly before the range start', () => {
    const buckets = enumerateBuckets(
      new Date(2026, 2, 11),
      new Date(2026, 2, 11),
      'weekly',
    );
    expect(buckets).toHaveLength(1);
    expect(buckets[0].startDate.getDay()).toBe(1);
    expect(buckets[0].startDate).toEqual(new Date(2026, 2, 9));
  });

  it('enumerates months across a year boundary', () => {
    const buckets = enumerateBuckets(
      new Date(2025, 10, 15),
      new Date(2026, 1, 3),
      'monthly',
    );
    expect(buckets.map((b) => b.key)).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
    expect(buckets[0].startDate).toEqual(new Date(2025, 10, 1));
  });

  it('enumerates years anchored to January 1st', () => {
    const buckets = enumerateBuckets(
      new Date(2024, 5, 15),
      new Date(2026, 0, 1),
      'yearly',
    );
    expect(buckets.map((b) => b.key)).toEqual(['2024', '2025', '2026']);
    expect(buckets[2].startDate).toEqual(new Date(2026, 0, 1));
  });
});
