import { setTimeout } from 'node:timers/promises';
import { Api, TelegramApiError, type Message, type SendMessageParams } from 'node-telegram-bot-api';
import { lazy } from '@/server/lib/lazy';
import { optionalEnv } from '@/server/env';
import { logger } from '@/server/observability';

// Telegram parses these as Markdown entities; an unescaped one inside user
// text (a merchant name, a description) makes the API reject the whole
// message with a 400 — which fails the daily-summary cron outright.
const TELEGRAM_MARKDOWN_ENTITY_CHARS = /[_*[`]/g;

export function escapeMarkdown(value: string): string {
  return value.replace(TELEGRAM_MARKDOWN_ENTITY_CHARS, (char) => `\\${char}`);
}

// v2 retries timeouts, so a retried send could deliver twice; fail fast instead.
const TELEGRAM_TIMEOUT_MS = 10_000;

const TOO_MANY_REQUESTS = 429;
// A 429 delivered nothing, so resending cannot duplicate. A longer flood-wait would hold the
// request past what a caller can wait, so it is surfaced instead.
const MAX_RETRY_AFTER_SECONDS = 60;
const MAX_RATE_LIMIT_RETRIES = 2;

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
    return this.sendRetryingRateLimits({ api, params, retriesLeft: MAX_RATE_LIMIT_RETRIES });
  }

  private async sendRetryingRateLimits({
    api,
    params,
    retriesLeft,
  }: {
    api: Api;
    params: SendMessageParams;
    retriesLeft: number;
  }): Promise<Message> {
    try {
      return await api.sendMessage(params);
    } catch (err) {
      const retryAfterSeconds = this.retryAfterSeconds(err);
      const shouldRetry = retryAfterSeconds !== null && retriesLeft > 0;
      if (!shouldRetry) {
        throw err;
      }
      logger.warn(
        { chatId: params.chat_id, retryAfterSeconds },
        'Telegram rate-limited the send, retrying after its wait',
      );
      await setTimeout(retryAfterSeconds * 1000);
      return this.sendRetryingRateLimits({ api, params, retriesLeft: retriesLeft - 1 });
    }
  }

  private retryAfterSeconds(err: unknown): number | null {
    const isRateLimited = err instanceof TelegramApiError && err.errorCode === TOO_MANY_REQUESTS;
    if (!isRateLimited) {
      return null;
    }
    const retryAfter = err.retryAfter ?? 1;
    return retryAfter <= MAX_RETRY_AFTER_SECONDS ? retryAfter : null;
  }
}

export const telegramService = new TelegramService();
