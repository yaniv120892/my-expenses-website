import path from 'path';

const KEY_SAFE_EXTENSION = /^\.[a-z0-9]{1,10}$/;

/** Drops an extension a URL path would not carry verbatim; the file name itself lives in the database. */
export function buildStorageObjectName({ fileName, id }: { fileName: string; id: string }): string {
  const extension = path.extname(fileName).toLowerCase();
  return KEY_SAFE_EXTENSION.test(extension) ? `${id}${extension}` : id;
}
