import logger from '@/server/logging/logger';
import { optionalEnv } from '@/server/env';
import { incrementWithTtl } from '@/server/redis';
import { telegramService } from '@/server/services/telegramService';

export interface OpsAlert {
  alertType: string;
  title: string;
  err?: unknown;
  context?: Record<string, string | number | undefined>;
}

const ALERTS_PER_HOUR = 5;
const SUPPRESSION_NOTICE_COUNT = ALERTS_PER_HOUR + 1;
const WINDOW_SECONDS = 60 * 60;

const TELEGRAM_MARKDOWN_ENTITY_CHARS = /[_*[`]/g;

function escapeMarkdown(value: string): string {
  return value.replace(TELEGRAM_MARKDOWN_ENTITY_CHARS, (char) => `\\${char}`);
}

function quotaKey(alertType: string): string {
  const normalized = alertType
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 80);
  return `ops-alert:${normalized}`;
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) {
    return err.message;
  }
  if (err === undefined || err === null) {
    return '';
  }
  return String(err);
}

function formatAlert({ title, err, context }: OpsAlert): string {
  const lines = [`🚨 *${escapeMarkdown(title)}*`];
  const message = errorMessage(err);
  if (message) {
    lines.push(escapeMarkdown(message));
  }
  for (const [key, value] of Object.entries(context ?? {})) {
    if (value !== undefined) {
      lines.push(`${escapeMarkdown(key)}: ${escapeMarkdown(String(value))}`);
    }
  }
  return lines.join('\n');
}

function formatSuppressionNotice(alertType: string): string {
  return [
    '🔇 *Ops alerts suppressed*',
    `More than ${ALERTS_PER_HOUR} "${escapeMarkdown(alertType)}" alerts this hour.`,
    'Further alerts of this type are dropped until the window resets.',
  ].join('\n');
}

export async function notifyOpsAlert(alert: OpsAlert): Promise<void> {
  const chatId = optionalEnv('TELEGRAM_ALERT_CHAT_ID');
  if (!chatId) {
    return;
  }
  try {
    const count = await incrementWithTtl(
      quotaKey(alert.alertType),
      WINDOW_SECONDS,
    );
    if (count > SUPPRESSION_NOTICE_COUNT) {
      return;
    }
    const message =
      count === SUPPRESSION_NOTICE_COUNT
        ? formatSuppressionNotice(alert.alertType)
        : formatAlert(alert);
    await telegramService.sendMessage(chatId, message);
  } catch (err) {
    logger.error({ err, title: alert.title }, 'Failed to send ops alert');
  }
}
