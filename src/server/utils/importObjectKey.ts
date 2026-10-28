import { buildStorageObjectName } from '@/server/utils/storageObjectName';

export function buildImportObjectKey(fileName: string, id: string): string {
  return `imports/${buildStorageObjectName(fileName, id)}`;
}
