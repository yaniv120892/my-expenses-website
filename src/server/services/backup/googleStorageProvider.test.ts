import { generateKeyPairSync } from 'crypto';
import { Readable } from 'stream';
import { text } from 'stream/consumers';
import { type Common, google } from 'googleapis';
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
const WEB_VIEW_LINK = 'https://drive.google.com/file/d/file-1/view';

const RESPONSES: Record<string, unknown> = {
  [TOKEN_URL]: { access_token: 'test-token', expires_in: 3600 },
  [UPLOAD_URL]: { id: 'file-1', webViewLink: WEB_VIEW_LINK },
};

const SERVICE_ACCOUNT_KEY = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString();

// The installed tree can hold several gaxios copies (a direct import resolves
// the ESM build; google-auth-library may nest its own), so the stub targets the
// class the JWT client actually sends through.
function stubGoogleHttp(): SentRequest[] {
  const sent: SentRequest[] = [];
  const { transporter } = new google.auth.JWT({});
  const transporterPrototype: typeof Common.Gaxios.prototype = Object.getPrototypeOf(transporter);
  vi.spyOn(transporterPrototype, 'request').mockImplementation(async function respond(config = {}) {
    const url = String(config.url);
    if (!(url in RESPONSES)) {
      throw new Error(`unexpected Google request: ${config.method} ${url}`);
    }
    const headers = new Headers(config.headers);
    sent.push({
      method: config.method ?? 'GET',
      url,
      headers,
      params: config.params ?? {},
      body: await readBody(config.data),
    });
    const data = RESPONSES[url];
    return Object.assign(new Response(JSON.stringify(data)), {
      config: { ...config, url: new URL(url), headers },
      data,
    });
  });
  return sent;
}

async function readBody(data: unknown): Promise<string> {
  return data instanceof Readable ? text(data) : String(data ?? '');
}

describe('GoogleStorageProvider.uploadBackup', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_SERVICE_ACCOUNT_EMAIL', SERVICE_ACCOUNT);
    vi.stubEnv('GOOGLE_PRIVATE_KEY', SERVICE_ACCOUNT_KEY.replace(/\n/g, '\\n'));
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

    expect(link).toBe(WEB_VIEW_LINK);
    expect(sent.map(({ method, url }) => `${method} ${url}`)).toEqual([
      `POST ${TOKEN_URL}`,
      `POST ${UPLOAD_URL}`,
    ]);

    const [token, upload] = sent;
    if (!token || !upload) {
      throw new Error(`expected a token and an upload request, got ${sent.length} requests`);
    }
    const assertion = new URLSearchParams(token.body).get('assertion') ?? '';
    const assertionParts = assertion.split('.');
    expect(assertionParts).toHaveLength(3);
    const [, payload = ''] = assertionParts;
    const claims: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString());
    expect(claims).toMatchObject({
      iss: SERVICE_ACCOUNT,
      scope: 'https://www.googleapis.com/auth/drive.file',
    });

    expect(upload.headers.get('authorization')).toBe('Bearer test-token');
    expect(upload.params).toMatchObject({
      uploadType: 'multipart',
      fields: 'id, webViewLink',
    });
    expect(upload.headers.get('content-type')).toMatch(/^multipart\/related; boundary=/);
    expect(upload.body).toContain(JSON.stringify({ name: 'backup.xlsx', parents: ['folder-1'] }));
    expect(upload.body).toMatch(/content-type: application\/vnd\.ms-excel/i);
    expect(upload.body).toContain('spreadsheet-bytes');
  });
});
