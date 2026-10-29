import path from 'path';

const KEY_SAFE_EXTENSION = /^\.[a-z0-9]{1,10}$/;

/** The lowercased extension, or '' when it is one a URL path would not carry verbatim. */
export function keySafeExtension(fileName: string): string {
  const extension = path.extname(fileName).toLowerCase();
  return KEY_SAFE_EXTENSION.test(extension) ? extension : '';
}

/** The file name itself lives in the database; the key carries only the id and extension. */
export function buildStorageObjectName({ fileName, id }: { fileName: string; id: string }): string {
  return `${id}${keySafeExtension(fileName)}`;
}
