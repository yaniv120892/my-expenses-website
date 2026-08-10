import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHandler } from '@/server/http/handler';
import { HttpError } from '@/server/http/errors';
import { lazy } from '@/server/lib/lazy';
import { requireEnv } from '@/server/env';
import logger from '@/server/logging/logger';

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

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

export const POST = createHandler({
  auth: 'session',
  handler: async ({ req }) => {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new HttpError(400, 'No file provided');
    }

    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      throw new HttpError(
        400,
        `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`,
      );
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new HttpError(400, 'File is too large. Maximum size is 10MB');
    }

    const bucket = requireEnv('IMPORTS_S3_BUCKET');
    const region = requireEnv('IMPORTS_S3_REGION');
    const fileName = `imports/${crypto.randomUUID()}-${file.name}`;

    try {
      await getS3Client().send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: fileName,
          Body: Buffer.from(await file.arrayBuffer()),
          ContentType: file.type,
        }),
      );
    } catch (err) {
      logger.error({ err, bucket, region }, 'S3 upload failed');
      throw new HttpError(500, 'Failed to upload file');
    }

    return {
      fileUrl: `https://${bucket}.s3.${region}.amazonaws.com/${fileName}`,
    };
  },
});
