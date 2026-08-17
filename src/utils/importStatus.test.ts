import { describe, it, expect } from 'vitest';
import { Import, ImportStatus } from '@/types/import';
import { hasActiveImports } from '@/utils/importStatus';

const NOW = Date.parse('2026-08-17T12:00:00.000Z');

function buildImport(overrides: Partial<Import> = {}): Import {
  return {
    id: 'import-1',
    fileUrl: 'https://example.com/file.csv',
    originalFileName: 'file.csv',
    importType: 'VISA_CREDIT',
    status: ImportStatus.COMPLETED,
    createdAt: new Date(NOW).toISOString(),
    updatedAt: new Date(NOW).toISOString(),
    isVerified: false,
    ...overrides,
  } as Import;
}

describe('hasActiveImports', () => {
  it('is false when there is nothing to poll for', () => {
    expect(hasActiveImports(undefined)).toBe(false);
    expect(hasActiveImports([])).toBe(false);
  });

  it.each([
    ImportStatus.PENDING,
    ImportStatus.PROCESSING,
    ImportStatus.REMATCHING,
  ])('is true for a %s import', (status) => {
    expect(hasActiveImports([buildImport({ status })])).toBe(true);
  });

  it.each([ImportStatus.COMPLETED, ImportStatus.FAILED])(
    'is false when every import is %s',
    (status) => {
      expect(hasActiveImports([buildImport({ status })])).toBe(false);
    },
  );

  it('is true when only one import of many is still active', () => {
    const imports = [
      buildImport({ id: 'a', status: ImportStatus.COMPLETED }),
      buildImport({ id: 'b', status: ImportStatus.PROCESSING }),
      buildImport({ id: 'c', status: ImportStatus.FAILED }),
    ];

    expect(hasActiveImports(imports)).toBe(true);
  });

  it('keeps saying an old in-flight import is active, whatever its timestamps say', () => {
    // How long to keep polling is the caller's call, measured on its own
    // clock; a stale updatedAt must not make an import look settled.
    const stale = buildImport({
      status: ImportStatus.PROCESSING,
      updatedAt: new Date(NOW - 60 * 60_000).toISOString(),
    });

    expect(hasActiveImports([stale])).toBe(true);
  });
});
