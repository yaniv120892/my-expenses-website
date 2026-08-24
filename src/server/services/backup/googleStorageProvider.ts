import { google } from 'googleapis';
import { Readable } from 'stream';
import { BackupStorageProvider } from '@/server/services/backup/backupStorageProvider';
import { lazy } from '@/server/lib/lazy';
import { optionalEnv, requireEnv } from '@/server/env';

export class GoogleStorageProvider implements BackupStorageProvider {
  private getDrive = lazy(() => {
    const clientEmail = optionalEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const privateKey = optionalEnv('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n');
    const auth = new google.auth.JWT({
      email: clientEmail,
      key: privateKey,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
    return google.drive({ version: 'v3', auth });
  });

  public async uploadBackup(
    fileName: string,
    fileContent: Buffer,
    mimeType: string,
  ): Promise<string> {
    const fileMetadata = {
      name: fileName,
      parents: [requireEnv('GOOGLE_DRIVE_FOLDER_ID')],
    };
    const streamFromBuffer = (buffer: Buffer) => {
      const readable = new Readable({
        read() {
          this.push(buffer);
          this.push(null);
        },
      });
      return readable;
    };
    const media = {
      mimeType,
      body: streamFromBuffer(fileContent),
    };
    const res = await this.getDrive().files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, webViewLink',
    });
    return res.data.webViewLink || '';
  }
}
