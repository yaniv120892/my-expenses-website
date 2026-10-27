import { describe, expect, it } from 'vitest';
import { buildImportObjectKey } from '@/server/utils/importObjectKey';

describe('buildImportObjectKey', () => {
  it('keeps a key that reads back unchanged as a URL path', () => {
    const key = buildImportObjectKey('visa #1234 10%-2026?.xlsx', 'abc');

    expect(key).toBe('imports/abc-visa_1234_10_-2026_.xlsx');
    expect(new URL(`https://bucket.example/${key}`).pathname).toBe(`/${key}`);
  });

  it('replaces non-Latin names and slashes rather than keeping them raw', () => {
    expect(buildImportObjectKey('../כרטיס/אשראי.xlsx', 'abc')).toBe('imports/abc-.._.xlsx');
  });
});
