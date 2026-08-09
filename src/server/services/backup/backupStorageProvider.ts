export interface BackupStorageProvider {
  uploadBackup(
    fileName: string,
    fileContent: Buffer,
    mimeType: string,
  ): Promise<string>;
}

export enum BackupStorageProviderType {
  GOOGLE = 'GOOGLE',
  AWS = 'AWS',
}
