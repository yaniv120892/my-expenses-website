import { describe, expect, it } from 'vitest';
import { buildStorageObjectName } from '@/server/utils/storageObjectName';

describe('buildStorageObjectName', () => {
  it.each([
    ['receipt', 'id'],
    ['march.2026.PDF', 'id.pdf'],
    ['.hidden', 'id'],
    ['scan.פדף', 'id'],
    ['../כרטיס/אשראי #1 10%?.csv', 'id.csv'],
    ['photo.j p g', 'id'],
    ['archive.averyverylongextension', 'id'],
  ])('builds %j as %j', (fileName, expected) => {
    expect(buildStorageObjectName({ fileName, id: 'id' })).toBe(expected);
  });
});
