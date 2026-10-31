import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as SessionModule from '@/server/auth/session';
import type * as NextServerModule from 'next/server';
import { NextRequest } from 'next/server';

const { requireUser, send } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  send: vi.fn(),
}));

vi.mock('@/server/auth/householdActor', async () =>
  (await import('@/test/memberActor')).householdActorWithTestMembers(),
);
vi.mock('@/server/auth/session', async () => ({
  ...(await vi.importActual<typeof SessionModule>('@/server/auth/session')),
  requireUser,
}));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    public send = send;
  },
  PutObjectCommand: class {
    public constructor(public readonly input: { Key: string }) {}
  },
  GetObjectCommand: class {
    public constructor(public readonly input: { Key: string }) {}
  },
}));
vi.mock('@/server/observability', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof NextServerModule>('next/server')),
  after: vi.fn(),
}));

import { POST } from '@/app/api/imports/upload/route';
import { MAX_UPLOAD_BYTES } from '@/shared/uploadLimits';

const ROUTE_CONTEXT = { params: Promise.resolve(undefined) };

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue({ userId: 'user-1', tokenVersion: 0 });
  send.mockResolvedValue({});
  process.env.IMPORTS_S3_BUCKET = 'bucket';
  process.env.IMPORTS_S3_REGION = 'eu-central-1';
  process.env.IMPORTS_S3_ACCESS_KEY_ID = 'key';
  process.env.IMPORTS_S3_SECRET_ACCESS_KEY = 'secret';
});

describe('POST /api/imports/upload', () => {
  it('answers with a fileUrl whose path is the stored key, even for a name a URL would mangle', async () => {
    const form = new FormData();
    form.append('file', new File(['x'], 'visa #1234 10%.xlsx'));

    const response = await POST(
      new NextRequest('http://localhost/api/imports/upload', {
        method: 'POST',
        body: form,
      }),
      ROUTE_CONTEXT,
    );

    expect(response.status).toBe(200);
    const { fileUrl } = await response.json();
    const storedKey = send.mock.calls[0]?.[0].input.Key;
    expect(new URL(fileUrl).pathname).toBe(`/${storedKey}`);
  });

  it.each([
    ['Visa March.XLSX', 200, /^imports\/user-1\/[0-9a-f-]+\.xlsx$/],
    ['.xlsx', 400, undefined],
  ])(
    'stores %j only under a key ending with the extension it was accepted for',
    async (name, status, key) => {
      const form = new FormData();
      form.append('file', new File(['x'], name));

      const response = await POST(
        new NextRequest('http://localhost/api/imports/upload', { method: 'POST', body: form }),
        ROUTE_CONTEXT,
      );

      expect(response.status).toBe(status);
      expect(send.mock.calls[0]?.[0].input.Key).toEqual(
        key ? expect.stringMatching(key) : undefined,
      );
    },
  );

  function uploadOfSize(sizeInBytes: number) {
    const form = new FormData();
    form.append('file', new File([new Uint8Array(sizeInBytes)], 'statement.xlsx'));
    return POST(
      new NextRequest('http://localhost/api/imports/upload', {
        method: 'POST',
        body: form,
      }),
      ROUTE_CONTEXT,
    );
  }

  it('accepts a file of exactly 4 MB', async () => {
    const response = await uploadOfSize(MAX_UPLOAD_BYTES);

    expect(response.status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('413s a file one byte over 4 MB, naming its size and the limit, without storing it', async () => {
    const response = await uploadOfSize(MAX_UPLOAD_BYTES + 1);

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      message: 'statement.xlsx is 4.1 MB, over the 4 MB upload limit.',
    });
    expect(send).not.toHaveBeenCalled();
  });
});
