import { AwsStorageProvider } from '@/server/services/backup/awsStorageProvider';
import {
  BackupStorageProvider,
  BackupStorageProviderType,
} from '@/server/services/backup/backupStorageProvider';
import { GoogleStorageProvider } from '@/server/services/backup/googleStorageProvider';

class BackupStorageProviderFactory {
  public static getProvider(): BackupStorageProvider {
    const backupStorageProviderType =
      process.env.BACKUP_STORAGE_PROVIDER_TYPE || BackupStorageProviderType.AWS;
    switch (backupStorageProviderType) {
      case BackupStorageProviderType.AWS: {
        return new AwsStorageProvider();
      }
      case BackupStorageProviderType.GOOGLE:
      default: {
        return new GoogleStorageProvider();
      }
    }
  }
}

export default BackupStorageProviderFactory;
