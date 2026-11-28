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
// one batch stay well under it; a longer flood-wait is surfaced instead.
const RATE_LIMIT_WAIT_BUDGET_SECONDS = 30;

type WaitBudget = { remainingSeconds: number };

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

  /** A 429 delivered nothing, so resending after its wait cannot duplicate the message. */
  public async sendPlainMessagesWaitingOutRateLimits(
    chatId: string,
    messages: string[],
  ): Promise<unknown[]> {
    const api = this.getConfiguredApi(chatId);
    if (!api) {
      return [];
    }
    const waitBudget: WaitBudget = { remainingSeconds: RATE_LIMIT_WAIT_BUDGET_SECONDS };
    const failures: unknown[] = [];
    let transportFailure: unknown = null;
    for (const message of messages) {
      if (transportFailure !== null) {
        failures.push(transportFailure);
        continue;
      }
      try {
        await this.sendWithinWaitBudget({
          api,
          params: { chat_id: chatId, text: message },
          waitBudget,
        });
      } catch (err) {
        failures.push(err);
        // A timeout or dropped connection would hit every later message too, each after a full
        // timeout, so the rest count as failed without being sent.
        const isTransportFailure = !(err instanceof TelegramApiError);
        if (isTransportFailure) {
          transportFailure = err;
        }
      }
    }
    return failures;
  }

  private async send(params: SendMessageParams) {
    const api = this.getConfiguredApi(params.chat_id);
    if (!api) {
      return;
    }
    return api.sendMessage(params);
  }

  private getConfiguredApi(chatId: SendMessageParams['chat_id']): Api | null {
    const api = this.getApi();
    if (!api) {
      logger.warn({ chatId }, 'TELEGRAM_BOT_TOKEN is not set, skipping Telegram send');
    }
    return api;
  }

  private async sendWithinWaitBudget({
    api,
    params,
    waitBudget,
  }: {
    api: Api;
    params: SendMessageParams;
    waitBudget: WaitBudget;
  }): Promise<Message> {
    try {
      return await api.sendMessage(params);
    } catch (err) {
      const retryAfterSeconds = this.retryAfterSeconds(err);
      const fitsWaitBudget =
        retryAfterSeconds !== null && retryAfterSeconds <= waitBudget.remainingSeconds;
      if (!fitsWaitBudget) {
        throw err;
      }
      waitBudget.remainingSeconds -= retryAfterSeconds;
      logger.warn(
        { chatId: params.chat_id, retryAfterSeconds },
        'Telegram rate-limited the send, retrying after its wait',
      );
      await new Promise((resolve) => setTimeout(resolve, retryAfterSeconds * 1000));
      return this.sendWithinWaitBudget({ api, params, waitBudget });
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
