import { Import, ImportStatus } from '@/types/import';

/** Statuses where the extraction webhook has not landed yet. */
export const ACTIVE_IMPORT_STATUSES: readonly ImportStatus[] = [
  ImportStatus.PENDING,
  ImportStatus.PROCESSING,
  ImportStatus.REMATCHING,
];

export const IMPORTS_POLL_INTERVAL_MS = 5_000;

/**
 * How long to keep polling once something is in flight. An import whose
 * webhook never arrives stays active forever, and a forgotten tab should not
 * poll for days. Measured from when this client started watching, not from a
 * server timestamp — comparing the two against a local clock would let a
 * skewed clock disable polling outright. A reload starts the window again.
 */
export const MAX_ACTIVE_POLL_MS = 15 * 60_000;

export function hasActiveImports(imports: Import[] | undefined): boolean {
  return !!imports?.some((item) =>
    ACTIVE_IMPORT_STATUSES.includes(item.status),
  );
}
