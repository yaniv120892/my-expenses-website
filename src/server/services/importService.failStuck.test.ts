import { beforeEach, describe, expect, it, vi } from 'vitest';

const { failStuckProcessing } = vi.hoisted(() => ({
  failStuckProcessing: vi.fn(),
}));
vi.mock('@/server/repositories/importRepository', () => ({
  importRepository: { failStuckProcessing },
}));

import { importService } from '@/server/services/importService';

describe('importService.failStuckImports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fails imports created more than six hours ago, when no callback token can still land', async () => {
    failStuckProcessing.mockResolvedValue({
      importIds: ['imp-1'],
      failedCount: 1,
    });
    const now = new Date('2026-10-24T12:00:00Z');

    const result = await importService.failStuckImports(now);

    expect(failStuckProcessing).toHaveBeenCalledWith(
      new Date('2026-10-24T06:00:00Z'),
      'Extraction did not report back within 6 hours. Delete this import and upload the statement again.',
    );
    expect(result).toEqual({ failedImportCount: 1 });
  });
});
