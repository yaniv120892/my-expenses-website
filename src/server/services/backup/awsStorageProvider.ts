import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { BackupStorageProvider } from '@/server/services/backup/backupStorageProvider';
import { lazy } from '@/server/lib/lazy';
import { requireEnv } from '@/server/env';

export class AwsStorageProvider implements BackupStorageProvider {
  private getS3Client = lazy(
    () =>
      new S3Client({
        region: requireEnv('BACKUP_S3_REGION'),
        forcePathStyle: false,
        credentials: {
          accessKeyId: requireEnv('AWS_ACCESS_KEY_ID'),
          secretAccessKey: requireEnv('AWS_SECRET_ACCESS_KEY'),
        },
      }),
  );

  async uploadBackup(
    fileName: string,
    fileContent: Buffer,
    mimeType: string,
  ): Promise<string> {
    const bucketName = requireEnv('BACKUP_S3_BUCKET_NAME');
    const putCommand = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: fileContent,
      ContentType: mimeType,
    });
    await this.getS3Client().send(putCommand);
    const url = `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
    return url;
  }
}
