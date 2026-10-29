import { describe, expect, it } from 'vitest';
import { buildImportObjectKey } from '@/server/utils/importObjectKey';

describe('buildImportObjectKey', () => {
  it('keeps no part of the file name, only the id and the lowercased extension', () => {
    expect(buildImportObjectKey('Leumi statement March.XLSX', 'abc')).toBe('imports/abc.xlsx');
  });
});
