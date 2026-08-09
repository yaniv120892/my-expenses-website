import crypto from 'crypto';
import logger from '@/server/logging/logger';
import { requireEnv } from '@/server/env';

const TOKEN_EXPIRY_MS = 60 * 60 * 1000;

function getWebhookSecret(): string {
  return requireEnv('EXCEL_EXTRACTION_AGENT_WEBHOOK_SECRET');
}

export function generateWebhookToken(
  userId: string,
  timestamp: number,
): string {
  const secret = getWebhookSecret();

  const payload = `${userId}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const token = hmac.digest('base64url');

  logger.debug({ userId, timestamp }, 'Generated webhook token');

  return token;
}

export function verifyWebhookToken(
  token: string,
  userId: string,
  timestamp: number,
): boolean {
  // Called for its side effect: it throws when the webhook secret is missing,
  // failing fast before any comparison — inside the try block below the same
  // throw would be swallowed into a `false` return.
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
    const expectedToken = generateWebhookToken(userId, timestamp);
    const isValid = crypto.timingSafeEqual(
      Buffer.from(token),
      Buffer.from(expectedToken),
    );

    if (!isValid) {
      logger.warn(
        {
          userId,
          timestamp,
          tokenPreview: token.substring(0, 10) + '...',
        },
        'Webhook token verification failed',
      );
    }

    return isValid;
  } catch (err) {
    logger.error({ err, userId, timestamp }, 'Error verifying webhook token');
    return false;
  }
}

export function extractWebhookParams(query: Record<string, unknown>): {
  token: string;
  userId: string;
  timestamp: number;
} | null {
  const { token, userId, timestamp } = query;

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
  };
}
