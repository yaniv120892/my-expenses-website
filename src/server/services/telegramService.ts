import TelegramBot from 'node-telegram-bot-api';
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

class TelegramService {
  private getBot = lazy((): TelegramBot | null => {
    const token = optionalEnv('TELEGRAM_BOT_TOKEN');
    if (!token) {
      return null;
    }
    return new TelegramBot(token);
  });

  public async sendMessage(chatId: string, message: string) {
    const bot = this.getBot();
    if (!bot) {
      logger.warn(
        { chatId },
        'TELEGRAM_BOT_TOKEN is not set, skipping Telegram sendMessage',
      );
      return;
    }
    return bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  }

  /** For messages that are pure data: no parse_mode, so nothing to escape. */
  public async sendPlainMessage(chatId: string, message: string) {
    const bot = this.getBot();
    if (!bot) {
      logger.warn(
        { chatId },
        'TELEGRAM_BOT_TOKEN is not set, skipping Telegram sendPlainMessage',
      );
      return;
    }
    return bot.sendMessage(chatId, message);
  }

  public async editMessage(chatId: string, messageId: number, newText: string) {
    const bot = this.getBot();
    if (!bot) {
      logger.warn(
        { chatId, messageId },
        'TELEGRAM_BOT_TOKEN is not set, skipping Telegram editMessage',
      );
      return;
    }
    return bot.editMessageText(newText, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: 'Markdown',
    });
  }
}

export const telegramService = new TelegramService();
