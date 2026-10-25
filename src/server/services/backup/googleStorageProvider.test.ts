import { generateKeyPairSync } from 'crypto';
import { Readable } from 'stream';
import { Common } from 'googleapis';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleStorageProvider } from '@/server/services/backup/googleStorageProvider';

type SentRequest = {
  method: string;
  url: string;
  headers: Headers;
  params: Record<string, unknown>;
  body: string;
};

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const SERVICE_ACCOUNT = 'backup@project.iam.gserviceaccount.com';

// Stubs the HTTP client the SDK's auth and API layers share, reached through
// googleapis' own re-export so it is the instance they load.
function stubGoogleHttp(): SentRequest[] {
  const sent: SentRequest[] = [];
  vi.spyOn(Common.Gaxios.prototype, 'request').mockImplementation(
    async function respond(config = {}) {
      const url = String(config.url);
      const headers = new Headers(config.headers);
      sent.push({
        method: config.method ?? 'GET',
        url,
        headers,
        params: config.params ?? {},
        body: await readBody(config.data),
      });
      const data =
        url === TOKEN_URL
          ? { access_token: 'test-token', expires_in: 3600 }
          : {
              id: 'file-1',
              webViewLink: 'https://drive.google.com/file/d/file-1/view',
            };
      return Object.assign(new Response(JSON.stringify(data)), {
        config: { ...config, url: new URL(url), headers },
        data,
      });
    },
  );
  return sent;
}

async function readBody(data: unknown): Promise<string> {
  if (data instanceof Readable) {
    const chunks: Buffer[] = [];
    for await (const chunk of data) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString();
  }
  return String(data ?? '');
}

describe('GoogleStorageProvider.uploadBackup', () => {
  beforeEach(() => {
    const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', SERVICE_ACCOUNT);
    vi.stubEnv('GOOGLE_PRIVATE_KEY', pem.replace(/\n/g, '\\n'));
    vi.stubEnv('GOOGLE_DRIVE_FOLDER_ID', 'folder-1');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('signs in as the service account and uploads into the backup folder', async () => {
    const sent = stubGoogleHttp();

    const link = await new GoogleStorageProvider().uploadBackup(
      'backup.xlsx',
      Buffer.from('spreadsheet-bytes'),
      'application/vnd.ms-excel',
    );

    expect(link).toBe('https://drive.google.com/file/d/file-1/view');
    expect(sent.map(({ method, url }) => `${method} ${url}`)).toEqual([
      `POST ${TOKEN_URL}`,
      `POST ${UPLOAD_URL}`,
    ]);

    const [token, upload] = sent;
    const assertion = new URLSearchParams(token.body).get('assertion') ?? '';
    const claims: unknown = JSON.parse(
      Buffer.from(assertion.split('.')[1], 'base64url').toString(),
    );
    expect(claims).toMatchObject({
      iss: SERVICE_ACCOUNT,
      scope: 'https://www.googleapis.com/auth/drive.file',
    });

    expect(upload.headers.get('authorization')).toBe('Bearer test-token');
    expect(upload.params).toMatchObject({
      uploadType: 'multipart',
      fields: 'id, webViewLink',
    });
    expect(upload.headers.get('content-type')).toMatch(
      /^multipart\/related; boundary=/,
    );
    expect(upload.body).toContain(
      JSON.stringify({ name: 'backup.xlsx', parents: ['folder-1'] }),
    );
    expect(upload.body).toMatch(/content-type: application\/vnd\.ms-excel/i);
    expect(upload.body).toContain('spreadsheet-bytes');
  });
});
