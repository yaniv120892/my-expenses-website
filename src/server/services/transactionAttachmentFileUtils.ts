import {
  S3Client,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import path from 'path';
import { create as contentDisposition } from 'content-disposition';
import { lazy } from '@/server/lib/lazy';
import { requireEnv } from '@/server/env';

const getS3Client = lazy(
  () =>
    new S3Client({
      region: requireEnv('TRANSACTION_ATTACHMENT_S3_REGION'),
      credentials: {
        accessKeyId: requireEnv('TRANSACTION_ATTACHMENT_S3_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv(
          'TRANSACTION_ATTACHMENT_S3_SECRET_ACCESS_KEY',
        ),
      },
    }),
);

export async function buildPreviewUrl(key: string, expiresInSeconds = 600) {
  const command = new GetObjectCommand({
    Bucket: requireEnv('TRANSACTION_ATTACHMENT_S3_BUCKET_NAME'),
    Key: key,
  });
  return getSignedUrl(getS3Client(), command, {
    expiresIn: expiresInSeconds,
  });
}

export async function buildDownloadUrl(
  key: string,
  filename: string,
  expiresInSeconds = 600,
) {
  const command = new GetObjectCommand({
    Bucket: requireEnv('TRANSACTION_ATTACHMENT_S3_BUCKET_NAME'),
    Key: key,
    ResponseContentDisposition: contentDisposition(filename),
  });
  return getSignedUrl(getS3Client(), command, {
    expiresIn: expiresInSeconds,
  });
}

export async function getPresignedUploadUrl(
  transactionId: string,
  fileName: string,
  mimeType: string,
  expiresInSeconds = 600,
) {
  const fileKey = buildAttachmentKey(transactionId, fileName, randomUUID());
  const command = new PutObjectCommand({
    Bucket: requireEnv('TRANSACTION_ATTACHMENT_S3_BUCKET_NAME'),
    Key: fileKey,
    ContentType: mimeType,
  });
  const uploadUrl = await getSignedUrl(getS3Client(), command, {
    expiresIn: expiresInSeconds,
  });
  return { uploadUrl, fileKey };
}

export async function deleteAttachmentObject(key: string): Promise<void> {
  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: requireEnv('TRANSACTION_ATTACHMENT_S3_BUCKET_NAME'),
      Key: key,
    }),
  );
}

/**
 * Only a key the upload URL could have issued for this transaction. Dot
 * segments are refused because a URL client normalizes them, which would
 * climb out of the prefix.
 */
export function isAttachmentKeyForTransaction(
  fileKey: string,
  transactionId: string,
): boolean {
  const prefix = attachmentKeyPrefix(transactionId);
  const hasDotSegment = fileKey
    .split('/')
    .some((segment) => segment === '.' || segment === '..');
  return (
    fileKey.startsWith(prefix) &&
    fileKey.length > prefix.length &&
    !hasDotSegment
  );
}

export function buildAttachmentKey(
  transactionId: string,
  fileName: string,
  id: string,
): string {
  const { name, ext } = path.parse(fileName);
  return `${attachmentKeyPrefix(transactionId)}${id}-${name}${ext}`;
}

function attachmentKeyPrefix(transactionId: string): string {
  return `transactions/${transactionId}/`;
}
