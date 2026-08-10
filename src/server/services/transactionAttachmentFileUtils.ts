import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { lazy } from '@/server/lib/lazy';
import { requireEnv } from '@/server/env';

// The lockfile resolved s3-request-presigner to a newer minor than client-s3,
// so their private @smithy types diverge; the runtime contract is unchanged.
type PresignerClient = Parameters<typeof getSignedUrl>[0];

const getS3Client = lazy(
  () =>
    new S3Client({
      region: process.env.TRANSACTION_ATTACHMENT_S3_REGION,
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
  return getSignedUrl(getS3Client() as unknown as PresignerClient, command, {
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
    ResponseContentDisposition: `attachment; filename="${filename}"`,
  });
  return getSignedUrl(getS3Client() as unknown as PresignerClient, command, {
    expiresIn: expiresInSeconds,
  });
}

export async function getPresignedUploadUrl(
  transactionId: string,
  fileName: string,
  mimeType: string,
  expiresInSeconds = 600,
) {
  const ext = fileName.split('.').pop();
  const baseName = fileName.replace(`.${ext}`, '');
  const fileKey = `transactions/${transactionId}/${randomUUID()}-${baseName}.${ext}`;
  const command = new PutObjectCommand({
    Bucket: requireEnv('TRANSACTION_ATTACHMENT_S3_BUCKET_NAME'),
    Key: fileKey,
    ContentType: mimeType,
  });
  const uploadUrl = await getSignedUrl(
    getS3Client() as unknown as PresignerClient,
    command,
    {
      expiresIn: expiresInSeconds,
    },
  );
  return { uploadUrl, fileKey };
}
