import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toHouseholdId } from '@/server/auth/householdId';

const { listIdsWithVerifiedMember } = vi.hoisted(() => ({
  listIdsWithVerifiedMember: vi.fn(),
}));

vi.mock('@/server/repositories/householdRepository', () => ({
  default: { listIdsWithVerifiedMember },
}));

import backupService, { BACKUP_HOUSEHOLD_IDS_ENV } from '@/server/services/backupService';
import { logger } from '@/server/observability';

const OWNER_HOUSEHOLD = toHouseholdId('11111111-1111-4111-8111-111111111111');
const STRANGER_HOUSEHOLD = toHouseholdId('22222222-2222-4222-8222-222222222222');

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  listIdsWithVerifiedMember.mockResolvedValue([OWNER_HOUSEHOLD, STRANGER_HOUSEHOLD]);
});

describe('backupService.getHouseholdsRequiringBackup', () => {
  it('backs up no household, and says so, while the owner names none', async () => {
    vi.stubEnv(BACKUP_HOUSEHOLD_IDS_ENV, '');

    await expect(backupService.getHouseholdsRequiringBackup()).resolves.toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      { envVar: BACKUP_HOUSEHOLD_IDS_ENV },
      'No household is named for backup; backing up nothing',
    );
    expect(listIdsWithVerifiedMember).not.toHaveBeenCalled();
  });

  it('backs up only the households the owner names', async () => {
    vi.stubEnv(BACKUP_HOUSEHOLD_IDS_ENV, ` ${OWNER_HOUSEHOLD} ,`);

    await expect(backupService.getHouseholdsRequiringBackup()).resolves.toEqual([OWNER_HOUSEHOLD]);
  });

  it('skips a named household that has no verified member, and counts it', async () => {
    vi.stubEnv(BACKUP_HOUSEHOLD_IDS_ENV, `${OWNER_HOUSEHOLD},33333333-3333-4333-8333-333333333333`);

    await expect(backupService.getHouseholdsRequiringBackup()).resolves.toEqual([OWNER_HOUSEHOLD]);
    expect(logger.warn).toHaveBeenCalledWith(
      { envVar: BACKUP_HOUSEHOLD_IDS_ENV, unmatchedCount: 1 },
      'Some households named for backup have no verified member or do not exist',
    );
  });
});
