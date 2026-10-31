import { buildStorageObjectName } from '@/server/utils/storageObjectName';

const IMPORTS_ROOT = 'imports';
// What buildStorageObjectName makes of a random uuid: no dot, slash or percent
// sign besides the extension's dot, so the name cannot walk out of its folder.
const IMPORT_OBJECT_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(\.[a-z0-9]{1,10})?$/;

type ImportsBucket = { bucket: string; region: string };

// Under the uploader's own folder, so a key names whose statement it is.
export function buildImportObjectKey({
  userId,
  fileName,
  id,
}: {
  userId: string;
  fileName: string;
  id: string;
}): string {
  return `${IMPORTS_ROOT}/${userId}/${buildStorageObjectName({ fileName, id })}`;
}

export function importObjectUrl({ bucket, region, key }: ImportsBucket & { key: string }): string {
  return `${importsBucketOrigin({ bucket, region })}/${key}`;
}

// The key a submitted URL names, only when it is exactly one the upload
// endpoint wrote for this user. Compared as a string, never parsed: a URL
// parser resolves `..` and percent escapes, and the extraction service derives
// its key from the parsed path.
export function ownImportObjectKey({
  fileUrl,
  userId,
  bucket,
  region,
}: ImportsBucket & { fileUrl: string; userId: string }): string | null {
  const userFolder = `${importsBucketOrigin({ bucket, region })}/${IMPORTS_ROOT}/${userId}/`;
  if (!fileUrl.startsWith(userFolder)) {
    return null;
  }
  const objectName = fileUrl.slice(userFolder.length);
  if (!IMPORT_OBJECT_NAME.test(objectName)) {
    return null;
  }
  return `${IMPORTS_ROOT}/${userId}/${objectName}`;
}

function importsBucketOrigin({ bucket, region }: ImportsBucket): string {
  return `https://${bucket}.s3.${region}.amazonaws.com`;
}
