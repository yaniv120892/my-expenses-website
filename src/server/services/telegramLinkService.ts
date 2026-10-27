import crypto from 'crypto';
import { deleteValue, setValue, takeValue } from '@/server/redis';
import { optionalEnv } from '@/server/env';
import logger from '@/server/logging/logger';
import userRepository from '@/server/repositories/userRepository';
import userSettingsService from '@/server/services/userSettingsService';
import { telegramService } from '@/server/services/telegramService';
import type { TelegramLinkCode } from '@/shared/types/userSettings';

const LINK_CODE_TTL_SECONDS = 600;
// Telegram passes a deep link's `start` parameter as `/start <payload>`, and a
// group adds `@botname` to the command.
const START_COMMAND = /^\/start(?:@\w+)?(?:\s+(\S+))?\s*$/;

const REPLIES = {
  linked: 'This chat is now linked to your My Expenses account. Notifications will arrive here.',
  invalidCode:
    'This link code is invalid or has expired. Create a new one in My Expenses → Settings → Telegram.',
  noCode:
    'To receive notifications here, open My Expenses → Settings → Telegram and press "Link Telegram".',
};

type IncomingTelegramMessage = { chatId: string; text?: string };

type TestMessageOutcome = { success: boolean; message: string };

function linkCodeKey(code: string): string {
  return `telegramLinkCode:${code}`;
}

function outstandingCodeKey(userId: string): string {
  return `telegramLinkCode:user:${userId}`;
}

class TelegramLinkService {
  public async issueLinkCode(userId: string): Promise<TelegramLinkCode> {
    await this.revokeOutstandingCode(userId);
    const code = crypto.randomBytes(12).toString('base64url');
    await setValue(linkCodeKey(code), userId, LINK_CODE_TTL_SECONDS, 'branch');
    await setValue(outstandingCodeKey(userId), code, LINK_CODE_TTL_SECONDS, 'branch');
    logger.info({ userId }, 'Issued Telegram link code');
    return {
      code,
      command: `/start ${code}`,
      deepLink: this.deepLink(code),
      expiresInSeconds: LINK_CODE_TTL_SECONDS,
    };
  }

  public async handleIncomingMessage(message: IncomingTelegramMessage): Promise<void> {
    const match = message.text?.trim().match(START_COMMAND);
    if (!match) {
      return;
    }
    const code = match[1];
    if (!code) {
      await this.reply({ chatId: message.chatId, text: REPLIES.noCode });
      return;
    }
    const userId = await takeValue<string>(linkCodeKey(code), 'branch');
    if (!userId) {
      logger.info(
        { chatId: message.chatId },
        'Telegram link code unknown, expired or already used',
      );
      await this.reply({ chatId: message.chatId, text: REPLIES.invalidCode });
      return;
    }
    await this.bindChat({ userId, code, chatId: message.chatId });
    logger.info({ userId, chatId: message.chatId }, 'Telegram chat linked');
    await this.reply({ chatId: message.chatId, text: REPLIES.linked });
  }

  public async unlink(userId: string): Promise<void> {
    await this.revokeOutstandingCode(userId);
    await userRepository.setTelegramChat({ userId, chatId: null });
    logger.info({ userId }, 'Telegram chat unlinked');
  }

  // Only ever the linked chat, never one a request names, so the bot cannot be
  // pointed at a chat that did not ask for it.
  public async sendTestMessage(userId: string): Promise<TestMessageOutcome> {
    const chatId = await userSettingsService.getLinkedTelegramChatId(userId);
    if (!chatId) {
      return {
        success: false,
        message: 'No Telegram chat is linked. Link one first.',
      };
    }
    try {
      await telegramService.sendMessage(chatId, 'test my expenses connection');
      return {
        success: true,
        message: 'Test telegram message sent successfully',
      };
    } catch (err) {
      logger.error({ err, userId, chatId }, 'Failed to send test telegram message');
      return {
        success: false,
        message:
          'Failed to send test telegram message. Check the chat has not blocked the bot, or link it again.',
      };
    }
  }

  // The code is consumed before the write so two chats racing for it cannot
  // both bind; a failed write puts it back so Telegram's redelivery succeeds.
  private async bindChat({
    userId,
    code,
    chatId,
  }: {
    userId: string;
    code: string;
    chatId: string;
  }): Promise<void> {
    try {
      await userRepository.setTelegramChat({ userId, chatId });
    } catch (err) {
      await setValue(linkCodeKey(code), userId, LINK_CODE_TTL_SECONDS, 'branch');
      throw err;
    }
  }

  // One live code per user, so unlinking or issuing a new code leaves no
  // earlier code that could still bind a chat.
  private async revokeOutstandingCode(userId: string): Promise<void> {
    const code = await takeValue<string>(outstandingCodeKey(userId), 'branch');
    if (code) {
      await deleteValue(linkCodeKey(code), 'branch');
    }
  }

  private deepLink(code: string): string | null {
    const botUsername = optionalEnv('TELEGRAM_BOT_USERNAME').replace(/^@/, '');
    return botUsername ? `https://t.me/${botUsername}?start=${code}` : null;
  }

  // The link is already written; a failed reply must not 500 the webhook,
  // which would only make Telegram redeliver a consumed code.
  private async reply({ chatId, text }: { chatId: string; text: string }): Promise<void> {
    try {
      await telegramService.sendPlainMessage(chatId, text);
    } catch (err) {
      logger.warn({ err, chatId }, 'Failed to reply to a Telegram message');
    }
  }
}

const telegramLinkService = new TelegramLinkService();
export default telegramLinkService;
