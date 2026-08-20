import logger from '@/server/logging/logger';
import { optionalEnv } from '@/server/env';
import { incrementWithTtl } from '@/server/redis';
import { telegramService } from '@/server/services/telegramService';

export interface OpsAlert {
  title: string;
  err?: unknown;
  context?: Record<string, string | number | undefined>;
}

// A 5xx storm must not flood Telegram or burn the Upstash free tier's 500K
// monthly command budget, so every alert type gets its own hourly quota and
// the check itself costs a single INCR.
const ALERTS_PER_HOUR = 5;
const WINDOW_SECONDS = 60 * 60;

// telegramService sends with parse_mode 'Markdown', where these open an
// entity; an unescaped one in an error message makes Telegram reject the send.
const MARKDOWN_SPECIAL = /[_*[`]/g;

function escapeMarkdown(value: string): string {
  return value.replace(MARKDOWN_SPECIAL, (char) => `\\${char}`);
}

function rateLimitKey(title: string): string {
  const type = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 80);
  return `ops-alert:${type}`;
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

function formatSuppressionNotice(title: string): string {
  return [
    '🔇 *Ops alerts suppressed*',
    `More than ${ALERTS_PER_HOUR} "${escapeMarkdown(title)}" alerts this hour.`,
    'Further alerts of this type are dropped until the window resets.',
  ].join('\n');
}

// Best-effort by design: alerting must never turn into a request failure, so
// everything past the env check is swallowed and logged.
export async function notifyOpsAlert(alert: OpsAlert): Promise<void> {
  const chatId = optionalEnv('TELEGRAM_ALERT_CHAT_ID');
  if (!chatId) {
    return;
  }
  try {
    const count = await incrementWithTtl(
      rateLimitKey(alert.title),
      WINDOW_SECONDS,
    );
    if (count > ALERTS_PER_HOUR + 1) {
      return;
    }
    const message =
      count > ALERTS_PER_HOUR
        ? formatSuppressionNotice(alert.title)
        : formatAlert(alert);
    await telegramService.sendMessage(chatId, message);
  } catch (err) {
    logger.error({ err, title: alert.title }, 'Failed to send ops alert');
  }
}
