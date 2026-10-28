import path from 'path';

const KEY_SAFE_EXTENSION = /^\.[a-z0-9]{1,10}$/;

/**
 * An object key is logged and travels in URLs, so it carries only a random id
 * and the lowercased extension, never the user's file name; that name is kept
 * in the database. An extension a URL path would not carry verbatim is dropped.
 */
export function buildStorageObjectName(fileName: string, id: string): string {
  const extension = path.extname(fileName).toLowerCase();
  return KEY_SAFE_EXTENSION.test(extension) ? `${id}${extension}` : id;
}
