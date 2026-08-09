import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { requireUser, AuthError } from '@/server/auth/session';
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

export async function POST(request: NextRequest) {
  try {
    await requireUser(request);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 401 },
      );
    }
    throw error;
  }

  try {
    const file = await extractFileFromRequest(request);
    const validationError = validateFile(file);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const fileBuffer = await file.arrayBuffer();
    const fileName = generateUniqueFileName(file.name);
    const fileUrl = await uploadFileToS3(fileName, fileBuffer, file.type);

    return NextResponse.json({ fileUrl });
  } catch (error) {
    logger.error({ error }, 'Error uploading file');
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 },
    );
  }
}

async function extractFileFromRequest(request: NextRequest): Promise<File> {
  const formData = await request.formData();
  const file = formData.get('file') as File;

  if (!file) {
    throw new Error('No file provided');
  }

  return file;
}

function validateFile(file: File): string | null {
  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return `Unsupported file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return 'File is too large. Maximum size is 10MB';
  }
  return null;
}

function generateUniqueFileName(originalFileName: string): string {
  return `imports/${crypto.randomUUID()}-${originalFileName}`;
}

async function uploadFileToS3(
  fileName: string,
  fileBuffer: ArrayBuffer,
  contentType: string,
): Promise<string> {
  try {
    const putCommand = new PutObjectCommand({
      Bucket: process.env.IMPORTS_S3_BUCKET || '',
      Key: fileName,
      Body: Buffer.from(fileBuffer),
      ContentType: contentType,
    });

    await getS3Client().send(putCommand);
    return generateS3Url(fileName);
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined,
        bucket: process.env.IMPORTS_S3_BUCKET,
        region: process.env.IMPORTS_S3_REGION,
      },
      'S3 upload failed',
    );
    throw error;
  }
}

function generateS3Url(fileName: string): string {
  return `https://${process.env.IMPORTS_S3_BUCKET}.s3.${process.env.IMPORTS_S3_REGION}.amazonaws.com/${fileName}`;
}
