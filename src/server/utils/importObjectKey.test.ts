import { describe, expect, it } from 'vitest';
import { buildImportObjectKey } from '@/server/utils/importObjectKey';

describe('buildImportObjectKey', () => {
  it('keeps no part of the file name, only the id and the lowercased extension', () => {
    const key = buildImportObjectKey('Leumi statement March.XLSX', 'abc');

    expect(key).toBe('imports/abc.xlsx');
    for (const part of ['Leumi', 'statement', 'March']) {
      expect(key.toLowerCase()).not.toContain(part.toLowerCase());
    }
  });

  it('reads back unchanged as a URL path, whatever the name holds', () => {
    const key = buildImportObjectKey('../כרטיס/אשראי #1 10%?.csv', 'abc');

    expect(key).toBe('imports/abc.csv');
    expect(new URL(`https://bucket.example/${key}`).pathname).toBe(`/${key}`);
  });
});
