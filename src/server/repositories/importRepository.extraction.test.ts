import { beforeEach, describe, expect, it, vi } from 'vitest';

const { update, updateMany } = vi.hoisted(() => ({ update: vi.fn(), updateMany: vi.fn() }));
vi.mock('@/server/db/client', () => ({
  default: { import: { update, updateMany } },
}));

import { importRepository } from '@/server/repositories/importRepository';
import { toHouseholdId } from '@/server/auth/householdId';

const HOUSEHOLD_ID = toHouseholdId('household-1');

describe('importRepository extraction writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records the request id only while no callback has claimed the import', async () => {
    await importRepository.recordExtractionRequestId(HOUSEHOLD_ID, 'imp-1', 'req-9');

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'imp-1', householdId: HOUSEHOLD_ID, extractionCompletedAt: null },
      data: { excelExtractionRequestId: 'req-9' },
    });
  });

  it('fails the import only while no callback has claimed it', async () => {
    await importRepository.markFailedIfUnclaimed(HOUSEHOLD_ID, 'imp-1', 'agent down');

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'imp-1', householdId: HOUSEHOLD_ID, extractionCompletedAt: null },
      data: { status: 'FAILED', error: 'agent down' },
    });
  });

  it('writes the extracted metadata as given, nulls included', async () => {
    await importRepository.updateExtractionMetadata(HOUSEHOLD_ID, 'imp-1', {
      creditCardLastFourDigits: null,
      paymentMonth: '03/2026',
      bankSourceType: null,
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'imp-1', householdId: HOUSEHOLD_ID },
      data: { creditCardLastFourDigits: null, paymentMonth: '03/2026', bankSourceType: null },
    });
  });

  it('builds the merge ops: survivor to REMATCHING, duplicate to MERGED pointing at it', () => {
    importRepository.markRematchingOp(HOUSEHOLD_ID, 'imp-old');
    importRepository.markMergedIntoOp(HOUSEHOLD_ID, 'imp-1', 'imp-old');

    expect(update.mock.calls).toEqual([
      [{ where: { id: 'imp-old', householdId: HOUSEHOLD_ID }, data: { status: 'REMATCHING' } }],
      [
        {
          where: { id: 'imp-1', householdId: HOUSEHOLD_ID },
          data: {
            status: 'MERGED',
            mergedIntoImportId: 'imp-old',
            completedAt: expect.any(Date),
          },
        },
      ],
    ]);
  });
});
