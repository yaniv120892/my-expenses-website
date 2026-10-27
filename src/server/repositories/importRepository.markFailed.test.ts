import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateMany } = vi.hoisted(() => ({ updateMany: vi.fn() }));
vi.mock('@/server/db/client', () => ({
  default: { import: { updateMany } },
}));

import { importRepository } from '@/server/repositories/importRepository';

describe('importRepository.markFailedIfProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes FAILED only over PROCESSING and reports whether it did', async () => {
    updateMany.mockResolvedValue({ count: 0 });

    const failed = await importRepository.markFailedIfProcessing('imp-1', 'boom');

    expect(failed).toBe(false);
    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'imp-1', status: 'PROCESSING' },
      data: { status: 'FAILED', error: 'boom' },
    });
  });
});
