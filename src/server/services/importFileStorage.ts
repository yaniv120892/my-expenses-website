import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { lazy } from '@/server/lib/lazy';
import { requireEnv } from '@/server/env';
import { importObjectUrl } from '@/server/utils/importObjectKey';

// Long enough for a reader to start on a submitted import, which downloads the
// file before any model call.
const EXTRACTION_DOWNLOAD_URL_TTL_SECONDS = 15 * 60;

const getS3Client = lazy(
  () =>
    new S3Client({
      region: requireEnv('IMPORTS_S3_REGION'),
      credentials: {
        accessKeyId: requireEnv('IMPORTS_S3_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('IMPORTS_S3_SECRET_ACCESS_KEY'),
      },
    }),
);

export function importsBucket(): { bucket: string; region: string } {
  return { bucket: requireEnv('IMPORTS_S3_BUCKET'), region: requireEnv('IMPORTS_S3_REGION') };
}

/** Returns the object's plain URL: an identifier for the import, not a credential. */
export async function putImportObject({
  key,
  body,
  contentType,
}: {
  key: string;
  body: Buffer;
  contentType: string;
}): Promise<string> {
  const { bucket, region } = importsBucket();
  await getS3Client().send(
    new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }),
  );
  return importObjectUrl({ bucket, region, key });
}

// The bucket is private, so a reader holding no credentials of its own needs
// this signed, expiring URL. Today's extraction service ignores the signature:
// it takes the key from the path and reads it with its own credentials, so the
// ownership check, not this URL, is what keeps users apart.
export async function presignImportDownload(key: string): Promise<string> {
  return getSignedUrl(
    getS3Client(),
    new GetObjectCommand({ Bucket: importsBucket().bucket, Key: key }),
    { expiresIn: EXTRACTION_DOWNLOAD_URL_TTL_SECONDS },
  );
}
