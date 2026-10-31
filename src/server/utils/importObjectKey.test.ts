import { describe, expect, it } from 'vitest';
import { buildImportObjectKey, ownImportObjectKey } from '@/server/utils/importObjectKey';

const BUCKET = { bucket: 'bucket', region: 'eu-west-3' };
const ORIGIN = 'https://bucket.s3.eu-west-3.amazonaws.com';
const ID = '0b4c5a52-1d0e-4b8e-9a51-6f1f3c2d7e90';

describe('buildImportObjectKey', () => {
  it('files the object under its uploader, keeping only the id and lowercased extension', () => {
    expect(
      buildImportObjectKey({ userId: 'user-1', fileName: 'Leumi statement March.XLSX', id: ID }),
    ).toBe(`imports/user-1/${ID}.xlsx`);
  });
});

describe('ownImportObjectKey', () => {
  const own = (fileUrl: string, userId = 'user-1') =>
    ownImportObjectKey({ fileUrl, userId, ...BUCKET });

  it('returns the key of an object the user uploaded', () => {
    expect(own(`${ORIGIN}/imports/user-1/${ID}.csv`)).toBe(`imports/user-1/${ID}.csv`);
  });

  it.each([
    ['another user’s folder', `${ORIGIN}/imports/user-2/${ID}.csv`],
    ['a folder whose name only starts with the user id', `${ORIGIN}/imports/user-10/${ID}.csv`],
    ['the pre-folder layout', `${ORIGIN}/imports/${ID}-statement.csv`],
    ['another bucket', `https://other.s3.eu-west-3.amazonaws.com/imports/user-1/${ID}.csv`],
    ['a dot-dot climb', `${ORIGIN}/imports/user-1/../user-2/${ID}.csv`],
    ['an escaped climb', `${ORIGIN}/imports/user-1/%2e%2e/user-2/${ID}.csv`],
    ['an escaped slash', `${ORIGIN}/imports/user-1/${ID}%2F..%2F..%2Fuser-2%2F${ID}.csv`],
    ['a nested path', `${ORIGIN}/imports/user-1/nested/${ID}.csv`],
    ['a query string', `${ORIGIN}/imports/user-1/${ID}.csv?versionId=1`],
    ['a name that is not an upload id', `${ORIGIN}/imports/user-1/statement.csv`],
  ])('refuses %s', (_, fileUrl) => {
    expect(own(fileUrl)).toBeNull();
  });
});
