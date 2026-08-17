import crypto from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  generateWebhookToken,
  verifyWebhookToken,
  extractWebhookParams,
} from '@/server/utils/webhookAuth';

const SECRET = 'test-webhook-secret';

function sign(
  userId: string,
  timestamp: number,
  secret = SECRET,
  importId?: string,
): string {
  const payload = importId
    ? `${userId}:${timestamp}:${importId}`
    : `${userId}:${timestamp}`;
  return crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
}

beforeEach(() => {
  process.env.EXCEL_EXTRACTION_AGENT_WEBHOOK_SECRET = SECRET;
});

describe('generateWebhookToken', () => {
  it('produces the HMAC-SHA256 base64url of "userId:timestamp"', () => {
    const timestamp = 1754900000000;
    expect(generateWebhookToken('user-1', timestamp)).toBe(
      sign('user-1', timestamp),
    );
  });

  it('binds the importId into the signature when one is given', () => {
    const timestamp = 1754900000000;
    expect(generateWebhookToken('user-1', timestamp, 'imp-1')).toBe(
      sign('user-1', timestamp, SECRET, 'imp-1'),
    );
  });

  it('signs differently with and without an importId', () => {
    const timestamp = 1754900000000;
    expect(generateWebhookToken('user-1', timestamp, 'imp-1')).not.toBe(
      generateWebhookToken('user-1', timestamp),
    );
  });

  it('throws when the webhook secret env var is missing', () => {
    delete process.env.EXCEL_EXTRACTION_AGENT_WEBHOOK_SECRET;
    expect(() => generateWebhookToken('user-1', Date.now())).toThrow(
      'EXCEL_EXTRACTION_AGENT_WEBHOOK_SECRET',
    );
  });
});

describe('verifyWebhookToken', () => {
  it('accepts a correctly-signed, fresh token', () => {
    const timestamp = Date.now();
    const token = sign('user-1', timestamp);
    expect(verifyWebhookToken(token, 'user-1', timestamp)).toBe(true);
  });

  it('accepts a token near the expiry boundary', () => {
    const timestamp = Date.now() - 60 * 60 * 1000 + 5000;
    const token = sign('user-1', timestamp);
    expect(verifyWebhookToken(token, 'user-1', timestamp)).toBe(true);
  });

  it('rejects a token signed with a different secret', () => {
    const timestamp = Date.now();
    const token = sign('user-1', timestamp, 'wrong-secret');
    expect(verifyWebhookToken(token, 'user-1', timestamp)).toBe(false);
  });

  it('rejects a token whose length differs from the expected signature', () => {
    const timestamp = Date.now();
    expect(verifyWebhookToken('short-token', 'user-1', timestamp)).toBe(false);
  });

  it('rejects an expired timestamp', () => {
    const timestamp = Date.now() - 60 * 60 * 1000 - 1000;
    const token = sign('user-1', timestamp);
    expect(verifyWebhookToken(token, 'user-1', timestamp)).toBe(false);
  });

  it('rejects a future timestamp even when correctly signed', () => {
    const timestamp = Date.now() + 60_000;
    const token = sign('user-1', timestamp);
    expect(verifyWebhookToken(token, 'user-1', timestamp)).toBe(false);
  });

  it('rejects when the payload userId differs from the signed one', () => {
    const timestamp = Date.now();
    const token = sign('user-1', timestamp);
    expect(verifyWebhookToken(token, 'user-2', timestamp)).toBe(false);
  });

  it('rejects when the timestamp is tampered after signing', () => {
    const timestamp = Date.now();
    const token = sign('user-1', timestamp);
    expect(verifyWebhookToken(token, 'user-1', timestamp - 1)).toBe(false);
  });

  it('rejects empty token or userId', () => {
    const timestamp = Date.now();
    expect(verifyWebhookToken('', 'user-1', timestamp)).toBe(false);
    expect(verifyWebhookToken(sign('user-1', timestamp), '', timestamp)).toBe(
      false,
    );
  });

  it('accepts an importId-bound token', () => {
    const timestamp = Date.now();
    const token = sign('user-1', timestamp, SECRET, 'imp-1');
    expect(verifyWebhookToken(token, 'user-1', timestamp, 'imp-1')).toBe(true);
  });

  it('still accepts a legacy token issued without an importId', () => {
    const timestamp = Date.now();
    const token = sign('user-1', timestamp);
    expect(verifyWebhookToken(token, 'user-1', timestamp)).toBe(true);
  });

  it('rejects when the importId is tampered after signing', () => {
    const timestamp = Date.now();
    const token = sign('user-1', timestamp, SECRET, 'imp-1');
    expect(verifyWebhookToken(token, 'user-1', timestamp, 'imp-2')).toBe(false);
  });

  it('rejects an importId-bound token replayed without the importId', () => {
    const timestamp = Date.now();
    const token = sign('user-1', timestamp, SECRET, 'imp-1');
    expect(verifyWebhookToken(token, 'user-1', timestamp)).toBe(false);
  });

  it('throws (not false) when the secret is missing', () => {
    delete process.env.EXCEL_EXTRACTION_AGENT_WEBHOOK_SECRET;
    const timestamp = Date.now();
    expect(() => verifyWebhookToken('token', 'user-1', timestamp)).toThrow(
      'Missing required environment variable',
    );
  });
});

describe('extractWebhookParams', () => {
  it('extracts and coerces valid query params', () => {
    expect(
      extractWebhookParams({
        token: 'abc',
        userId: 'u1',
        timestamp: '1754900000000',
      }),
    ).toEqual({ token: 'abc', userId: 'u1', timestamp: 1754900000000 });
  });

  it('carries the importId through when present', () => {
    expect(
      extractWebhookParams({
        token: 'abc',
        userId: 'u1',
        timestamp: '1754900000000',
        importId: 'imp-1',
      }),
    ).toEqual({
      token: 'abc',
      userId: 'u1',
      timestamp: 1754900000000,
      importId: 'imp-1',
    });
  });

  it('returns null when any param is missing', () => {
    expect(extractWebhookParams({ userId: 'u1', timestamp: '1' })).toBeNull();
    expect(extractWebhookParams({ token: 'abc', timestamp: '1' })).toBeNull();
    expect(extractWebhookParams({ token: 'abc', userId: 'u1' })).toBeNull();
  });

  it('returns null for a non-numeric timestamp', () => {
    expect(
      extractWebhookParams({ token: 'abc', userId: 'u1', timestamp: 'soon' }),
    ).toBeNull();
  });

  it('parses a numeric prefix the way parseInt does', () => {
    expect(
      extractWebhookParams({ token: 'abc', userId: 'u1', timestamp: '123abc' }),
    ).toEqual({ token: 'abc', userId: 'u1', timestamp: 123 });
  });
});
