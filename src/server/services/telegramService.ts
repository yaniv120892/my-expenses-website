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
// The sends run inside a request, and the shortest function limit is 60 s, so all the waits for
// one message stay well under it; a longer flood-wait is surfaced instead.
const RATE_LIMIT_WAIT_BUDGET_SECONDS = 30;

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
      params: { chat_id: chatId, text: message, parse_mode: 'Markdown' },
      waitBudgetSeconds: 0,
    });
  }

  public async sendPlainMessage(chatId: string, message: string) {
    return this.send({ params: { chat_id: chatId, text: message }, waitBudgetSeconds: 0 });
  }

  /**
   * Resends after a 429, which delivered nothing, so the resend cannot duplicate. Only for
   * callers that can hold their request through the wait; a webhook reply cannot.
   */
  public async sendPlainMessageWaitingOutRateLimits(chatId: string, message: string) {
    return this.send({
      params: { chat_id: chatId, text: message },
      waitBudgetSeconds: RATE_LIMIT_WAIT_BUDGET_SECONDS,
    });
  }

  private async send({
    params,
    waitBudgetSeconds,
  }: {
    params: SendMessageParams;
    waitBudgetSeconds: number;
  }) {
    const api = this.getApi();
    if (!api) {
      logger.warn(
        { chatId: params.chat_id },
        'TELEGRAM_BOT_TOKEN is not set, skipping Telegram send',
      );
      return;
    }
    return this.sendWaitingOutRateLimits({ api, params, waitBudgetSeconds });
  }

  private async sendWaitingOutRateLimits({
    api,
    params,
    waitBudgetSeconds,
  }: {
    api: Api;
    params: SendMessageParams;
    waitBudgetSeconds: number;
  }): Promise<Message> {
    try {
      return await api.sendMessage(params);
    } catch (err) {
      const retryAfterSeconds = this.retryAfterSeconds(err);
      const fitsWaitBudget = retryAfterSeconds !== null && retryAfterSeconds <= waitBudgetSeconds;
      if (!fitsWaitBudget) {
        throw err;
      }
      logger.warn(
        { chatId: params.chat_id, retryAfterSeconds },
        'Telegram rate-limited the send, retrying after its wait',
      );
      await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
      return this.sendWaitingOutRateLimits({
        api,
        params,
        waitBudgetSeconds: waitBudgetSeconds - retryAfterSeconds,
      });
    }
  }

  /** Positive, so every retry spends the budget and the retries end. */
  private retryAfterSeconds(err: unknown): number | null {
    const isRateLimited = err instanceof TelegramApiError && err.errorCode === TOO_MANY_REQUESTS;
    if (!isRateLimited) {
      return null;
    }
    const retryAfter = err.retryAfter;
    const isUsableWait = typeof retryAfter === 'number' && retryAfter > 0;
    return isUsableWait ? retryAfter : null;
  }
}

export const telegramService = new TelegramService();
