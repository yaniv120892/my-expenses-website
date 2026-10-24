import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { requireUser, send } = vi.hoisted(() => ({
  requireUser: vi.fn(),
  send: vi.fn(),
}));

vi.mock('@/server/auth/session', async () => ({
  ...(await vi.importActual<typeof import('@/server/auth/session')>(
    '@/server/auth/session',
  )),
  requireUser,
}));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    public send = send;
  },
  PutObjectCommand: class {
    constructor(public readonly input: { Key: string }) {}
  },
}));
vi.mock('@/server/logging/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/server/logging/betterStackStream', () => ({
  flushRemoteLogs: vi.fn(),
  betterStackStream: { write: vi.fn() },
}));
vi.mock('next/server', async () => ({
  ...(await vi.importActual<typeof import('next/server')>('next/server')),
  after: vi.fn(),
}));

import { POST } from '@/app/api/imports/upload/route';

const ROUTE_CONTEXT = { params: Promise.resolve(undefined) };

beforeEach(() => {
  vi.clearAllMocks();
  requireUser.mockResolvedValue('user-1');
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
    const storedKey = send.mock.calls[0][0].input.Key;
    expect(new URL(fileUrl).pathname).toBe(`/${storedKey}`);
  });
});
