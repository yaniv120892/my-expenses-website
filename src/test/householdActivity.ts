import { vi } from 'vitest';
import type { ActivityEntry } from '@/server/services/householdActivityService.types';

/**
 * Stands in for householdActivityService in a service test that mocks its
 * repositories: runs the write with no database transaction and keeps the
 * entries it would have appended, for the test to assert on.
 *
 *   const activity = vi.hoisted(() => { const entries: unknown[] = []; return { entries }; });
 *   vi.mock('@/server/services/householdActivityService', async () =>
 *     (await import('@/test/householdActivity')).householdActivityModule(activity.entries));
 */
export function householdActivityModule(entries: unknown[]) {
  return {
    default: {
      record: vi.fn(
        async <Result>({
          write,
          describe,
        }: {
          write: () => Promise<Result>;
          describe: (result: Result) => ActivityEntry | ActivityEntry[] | null;
        }) => {
          const result = await write();
          const description = describe(result);
          if (description !== null) {
            entries.push(...[description].flat());
          }
          return result;
        },
      ),
      listPage: vi.fn(),
    },
  };
}
