import { HttpError } from '@/server/http/errors';
import { exceedsUploadLimit, uploadTooLargeMessage } from '@/shared/uploadLimits';

export function assertWithinUploadLimit(file: { fileName: string; sizeInBytes: number }): void {
  if (exceedsUploadLimit(file.sizeInBytes)) {
    throw new HttpError(413, uploadTooLargeMessage(file));
  }
}
