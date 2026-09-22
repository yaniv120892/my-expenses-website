import { Import, ImportStatus } from '@/types/import';

export const ACTIVE_IMPORT_STATUSES: readonly ImportStatus[] = [
  ImportStatus.PENDING,
  ImportStatus.PROCESSING,
  ImportStatus.REMATCHING,
];

export const IMPORTS_POLL_INTERVAL_MS = 5_000;

// An import whose webhook never arrives stays active forever. Measured from when
// this client started watching, since a skewed local clock must not disable polling.
export const MAX_ACTIVE_POLL_MS = 15 * 60_000;

export function hasActiveImports(imports: Import[] | undefined): boolean {
  return !!imports?.some((item) =>
    ACTIVE_IMPORT_STATUSES.includes(item.status),
  );
}
