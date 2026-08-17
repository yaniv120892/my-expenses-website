import { Import, ImportStatus } from '@/types/import';

/** Statuses where the extraction webhook has not landed yet. */
export const ACTIVE_IMPORT_STATUSES: readonly ImportStatus[] = [
  ImportStatus.PENDING,
  ImportStatus.PROCESSING,
  ImportStatus.REMATCHING,
];

export const IMPORTS_POLL_INTERVAL_MS = 5_000;

// An import whose webhook never arrives stays active forever, so polling is
// capped by age rather than by status alone.
const MAX_ACTIVE_AGE_MS = 10 * 60_000;

export function hasActiveImports(
  imports: Import[] | undefined,
  now: number = Date.now(),
): boolean {
  if (!imports?.length) return false;

  return imports.some((item) => {
    if (!ACTIVE_IMPORT_STATUSES.includes(item.status)) return false;

    const updatedAt = Date.parse(item.updatedAt);
    if (Number.isNaN(updatedAt)) return false;

    return now - updatedAt < MAX_ACTIVE_AGE_MS;
  });
}
