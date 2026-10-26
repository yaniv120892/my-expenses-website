// Under the ~4.5 MB request body a serverless function accepts, so a file the
// app allows never meets the platform's own opaque 413 instead.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_LABEL = '4 MB';

export const BYTES_PER_MEGABYTE = 1024 * 1024;

export function exceedsUploadLimit(sizeInBytes: number): boolean {
  return sizeInBytes > MAX_UPLOAD_BYTES;
}

/** Rounded up, so a file just over the limit never reads as exactly the limit. */
export function megabytesRoundedUp(sizeInBytes: number): number {
  return Math.ceil((sizeInBytes / BYTES_PER_MEGABYTE) * 10) / 10;
}

export function uploadTooLargeMessage({
  fileName,
  sizeInBytes,
}: {
  fileName: string;
  sizeInBytes: number;
}): string {
  const megabytes = megabytesRoundedUp(sizeInBytes).toFixed(1);
  return `${fileName} is ${megabytes} MB, over the ${MAX_UPLOAD_LABEL} upload limit.`;
}
