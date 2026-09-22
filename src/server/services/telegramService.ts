import { Api, type SendMessageParams } from 'node-telegram-bot-api';
import { lazy } from '@/server/lib/lazy';
import { optionalEnv } from '@/server/env';
import logger from '@/server/logging/logger';

// Telegram parses these as Markdown entities; an unescaped one inside user
// text (a merchant name, a description) makes the API reject the whole
// message with a 400 — which fails the daily-summary cron outright.
const TELEGRAM_MARKDOWN_ENTITY_CHARS = /[_*[`]/g;

export function escapeMarkdown(value: string): string {
  return value.replace(TELEGRAM_MARKDOWN_ENTITY_CHARS, (char) => `\\${char}`);
}

// v2 retries timeouts, so a retried send could deliver twice; fail fast instead.
const TELEGRAM_TIMEOUT_MS = 10_000;

class TelegramService {
  private getApi = lazy((): Api | null => {
    const token = optionalEnv('TELEGRAM_BOT_TOKEN');
    if (!token) {
      return null;
    }
    return new Api(token, {
      timeoutMs: TELEGRAM_TIMEOUT_MS,
      maxRetries: 0,
    });
  });

  public async sendMessage(chatId: string, message: string) {
    return this.send({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
    });
  }

  public async sendPlainMessage(chatId: string, message: string) {
    return this.send({ chat_id: chatId, text: message });
  }

  private async send(params: SendMessageParams) {
    const api = this.getApi();
    if (!api) {
      logger.warn(
        { chatId: params.chat_id },
        'TELEGRAM_BOT_TOKEN is not set, skipping Telegram send',
      );
      return;
    }
    return api.sendMessage(params);
  }
}

export const telegramService = new TelegramService();
