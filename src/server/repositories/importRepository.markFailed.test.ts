import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateMany } = vi.hoisted(() => ({ updateMany: vi.fn() }));
vi.mock('@/server/db/client', () => ({
  default: { import: { updateMany } },
}));

import { importRepository } from '@/server/repositories/importRepository';
import { toHouseholdId } from '@/server/auth/householdId';

const HOUSEHOLD_ID = toHouseholdId('household-1');

describe('importRepository.markFailedIfProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes FAILED only over PROCESSING and reports whether it did', async () => {
    updateMany.mockResolvedValue({ count: 0 });

    const failed = await importRepository.markFailedIfProcessing(HOUSEHOLD_ID, 'imp-1', 'boom');

    expect(failed).toBe(false);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'imp-1', householdId: HOUSEHOLD_ID, status: 'PROCESSING' },
      data: { status: 'FAILED', error: 'boom' },
    });
  });
});
