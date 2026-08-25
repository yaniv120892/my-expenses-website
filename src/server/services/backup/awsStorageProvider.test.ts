import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AwsStorageProvider } from '@/server/services/backup/awsStorageProvider';

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    public send = vi.fn();
  },
  PutObjectCommand: class {},
}));

describe('AwsStorageProvider.uploadBackup', () => {
  beforeEach(() => {
    vi.stubEnv('BACKUP_S3_BUCKET_NAME', 'backups-bucket');
    vi.stubEnv('BACKUP_S3_REGION', 'il-central-1');
    vi.stubEnv('AWS_ACCESS_KEY_ID', 'key');
    vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds the object URL from the same region the client uploads to', async () => {
    // Regression: the URL once read AWS_REGION, which nothing sets, yielding
    // https://backups-bucket.s3.undefined.amazonaws.com/...
    const url = await new AwsStorageProvider().uploadBackup(
      'backup.xlsx',
      Buffer.from('x'),
      'application/vnd.ms-excel',
    );

    expect(url).toBe(
      'https://backups-bucket.s3.il-central-1.amazonaws.com/backup.xlsx',
    );
  });
});
