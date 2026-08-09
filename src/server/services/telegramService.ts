import TelegramBot from 'node-telegram-bot-api';
import { lazy } from '@/server/lib/lazy';
import { optionalEnv } from '@/server/env';
import logger from '@/server/logging/logger';

class TelegramService {
  private getBot = lazy((): TelegramBot | null => {
    const token = optionalEnv('TELEGRAM_BOT_TOKEN');
    if (!token) {
      return null;
    }
    return new TelegramBot(token);
  });

  async sendMessage(chatId: string, message: string) {
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

  async editMessage(chatId: string, messageId: number, newText: string) {
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
