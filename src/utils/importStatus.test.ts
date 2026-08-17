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
    expect(hasActiveImports(undefined, NOW)).toBe(false);
    expect(hasActiveImports([], NOW)).toBe(false);
  });

  it.each([
    ImportStatus.PENDING,
    ImportStatus.PROCESSING,
    ImportStatus.REMATCHING,
  ])('is true for a recent %s import', (status) => {
    expect(hasActiveImports([buildImport({ status })], NOW)).toBe(true);
  });

  it.each([ImportStatus.COMPLETED, ImportStatus.FAILED])(
    'is false when every import is %s',
    (status) => {
      expect(hasActiveImports([buildImport({ status })], NOW)).toBe(false);
    },
  );

  it('is true when only one import of many is still active', () => {
    const imports = [
      buildImport({ id: 'a', status: ImportStatus.COMPLETED }),
      buildImport({ id: 'b', status: ImportStatus.PROCESSING }),
      buildImport({ id: 'c', status: ImportStatus.FAILED }),
    ];

    expect(hasActiveImports(imports, NOW)).toBe(true);
  });

  it('stops polling a stranded import once it ages out', () => {
    const stranded = buildImport({
      status: ImportStatus.PROCESSING,
      updatedAt: new Date(NOW - 11 * 60_000).toISOString(),
    });

    expect(hasActiveImports([stranded], NOW)).toBe(false);
  });

  it('keeps polling an active import that is still inside the age window', () => {
    const recent = buildImport({
      status: ImportStatus.PROCESSING,
      updatedAt: new Date(NOW - 9 * 60_000).toISOString(),
    });

    expect(hasActiveImports([recent], NOW)).toBe(true);
  });

  it('ignores an import with an unparseable updatedAt', () => {
    const broken = buildImport({
      status: ImportStatus.PROCESSING,
      updatedAt: 'not-a-date',
    });

    expect(hasActiveImports([broken], NOW)).toBe(false);
  });
});
