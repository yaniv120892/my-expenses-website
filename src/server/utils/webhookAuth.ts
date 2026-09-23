import crypto from 'crypto';
import logger from '@/server/logging/logger';
import { requireEnv } from '@/server/env';

const TOKEN_EXPIRY_MS = 60 * 60 * 1000;

function getWebhookSecret(): string {
  return requireEnv('EXCEL_EXTRACTION_AGENT_WEBHOOK_SECRET');
}

// importId is optional only so callbacks already in flight at deploy time
// still verify. Tokens expire after TOKEN_EXPIRY_MS, so the unbound branch is
// dead an hour after rollout and both `importId?` parameters can be required.
export function generateWebhookToken(
  userId: string,
  timestamp: number,
  importId?: string,
): string {
  const secret = getWebhookSecret();

  const payload = importId
    ? `${userId}:${timestamp}:${importId}`
    : `${userId}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const token = hmac.digest('base64url');

  logger.debug({ userId, timestamp, importId }, 'Generated webhook token');

  return token;
}

export function verifyWebhookToken(
  token: string,
  userId: string,
  timestamp: number,
  importId?: string,
): boolean {
  // Throws on a missing secret here, where the try below would swallow it into
  // `false`.
  getWebhookSecret();

  if (!token || !userId || !timestamp) {
    logger.warn(
      {
        hasToken: !!token,
        hasUserId: !!userId,
        hasTimestamp: !!timestamp,
      },
      'Missing required parameters for token verification',
    );
    return false;
  }

  const now = Date.now();
  const age = now - timestamp;

  if (age > TOKEN_EXPIRY_MS) {
    logger.warn(
      { userId, timestamp, age, maxAge: TOKEN_EXPIRY_MS },
      'Webhook token expired',
    );
    return false;
  }

  if (age < 0) {
    logger.warn(
      { userId, timestamp, now },
      'Webhook token timestamp is in the future',
    );
    return false;
  }

  try {
    const expectedToken = generateWebhookToken(userId, timestamp, importId);
    const isValid = secretsEqual(token, expectedToken);

    if (!isValid) {
      logger.warn(
        {
          userId,
          timestamp,
          importId,
          tokenPreview: token.substring(0, 10) + '...',
        },
        'Webhook token verification failed',
      );
    }

    return isValid;
  } catch (err) {
    logger.error(
      { err, userId, timestamp, importId },
      'Error verifying webhook token',
    );
    return false;
  }
}

/**
 * Constant-time for equal-length inputs; a length mismatch returns early, since
 * timingSafeEqual throws on it and the length of a secret is not the secret.
 * An empty expected value never matches, so an unset secret cannot authorize.
 */
export function secretsEqual(
  provided: string | null,
  expected: string,
): boolean {
  if (!provided || !expected) {
    return false;
  }
  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);
  if (providedBytes.length !== expectedBytes.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBytes, expectedBytes);
}

export function extractWebhookParams(query: Record<string, string>): {
  token: string;
  userId: string;
  timestamp: number;
  importId?: string;
} | null {
  const { token, userId, timestamp, importId } = query;

  if (!token || !userId || !timestamp) {
    logger.warn(
      {
        hasToken: !!token,
        hasUserId: !!userId,
        hasTimestamp: !!timestamp,
      },
      'Missing webhook query parameters',
    );
    return null;
  }

  const timestampNum = parseInt(String(timestamp), 10);
  if (isNaN(timestampNum)) {
    logger.warn({ timestamp }, 'Invalid timestamp in webhook query');
    return null;
  }

  return {
    token: String(token),
    userId: String(userId),
    timestamp: timestampNum,
    importId: importId ? String(importId) : undefined,
  };
}
