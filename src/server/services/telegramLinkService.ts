import crypto from 'crypto';
import { setValue, takeValue } from '@/server/redis';
import { optionalEnv } from '@/server/env';
import logger from '@/server/logging/logger';
import userRepository from '@/server/repositories/userRepository';
import { telegramService } from '@/server/services/telegramService';
import type { TelegramLinkCode } from '@/shared/types/userSettings';

const LINK_CODE_TTL_SECONDS = 600;
// Telegram passes a deep link's `start` parameter as `/start <payload>`, and a
// group adds `@botname` to the command.
const START_COMMAND = /^\/start(?:@\w+)?(?:\s+(\S+))?\s*$/;

const REPLIES = {
  linked:
    'This chat is now linked to your My Expenses account. Notifications will arrive here.',
  invalidCode:
    'This link code is invalid or has expired. Create a new one in My Expenses → Settings → Telegram.',
  noCode:
    'To receive notifications here, open My Expenses → Settings → Telegram and press "Link Telegram".',
};

type IncomingTelegramMessage = { chatId: string; text?: string };

function linkCodeKey(code: string): string {
  return `telegramLinkCode:${code}`;
}

class TelegramLinkService {
  public async issueLinkCode(userId: string): Promise<TelegramLinkCode> {
    const code = crypto.randomBytes(12).toString('base64url');
    await setValue(linkCodeKey(code), userId, LINK_CODE_TTL_SECONDS, 'branch');
    logger.info({ userId }, 'Issued Telegram link code');
    return {
      code,
      command: `/start ${code}`,
      deepLink: this.deepLink(code),
      expiresInSeconds: LINK_CODE_TTL_SECONDS,
    };
  }

  public async handleIncomingMessage(
    message: IncomingTelegramMessage,
  ): Promise<void> {
    const match = message.text?.trim().match(START_COMMAND);
    if (!match) {
      return;
    }
    const code = match[1];
    if (!code) {
      await this.reply(message.chatId, REPLIES.noCode);
      return;
    }
    const userId = await takeValue<string>(linkCodeKey(code), 'branch');
    if (!userId) {
      logger.info(
        { chatId: message.chatId },
        'Telegram link code unknown, expired or already used',
      );
      await this.reply(message.chatId, REPLIES.invalidCode);
      return;
    }
    await userRepository.setTelegramChat(userId, message.chatId);
    logger.info({ userId, chatId: message.chatId }, 'Telegram chat linked');
    await this.reply(message.chatId, REPLIES.linked);
  }

  public async unlink(userId: string): Promise<void> {
    await userRepository.setTelegramChat(userId, null);
    logger.info({ userId }, 'Telegram chat unlinked');
  }

  private deepLink(code: string): string | null {
    const botUsername = optionalEnv('TELEGRAM_BOT_USERNAME').replace(/^@/, '');
    return botUsername ? `https://t.me/${botUsername}?start=${code}` : null;
  }

  // The link is already written; a failed reply must not 500 the webhook,
  // which would only make Telegram redeliver a consumed code.
  private async reply(chatId: string, text: string): Promise<void> {
    try {
      await telegramService.sendPlainMessage(chatId, text);
    } catch (err) {
      logger.warn({ err, chatId }, 'Failed to reply to a Telegram message');
    }
  }
}

const telegramLinkService = new TelegramLinkService();
export default telegramLinkService;
