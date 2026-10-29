import { afterEach, describe, expect, it, vi } from 'vitest';
import { toUtcDayString } from '@/shared/dates';

describe('toUtcDayString', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ['America/Los_Angeles', '2026-07-01T00:00:00Z', '2026-07-01'],
    ['Asia/Jerusalem', '2026-10-24T23:30:00Z', '2026-10-24'],
    ['Pacific/Kiritimati', '2026-12-31T23:59:59Z', '2026-12-31'],
  ])('reads the UTC calendar day on a %s host', (timeZone, instant, expected) => {
    vi.stubEnv('TZ', timeZone);

    expect(toUtcDayString(new Date(instant))).toBe(expected);
  });
});
