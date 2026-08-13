import { createHandler } from '@/server/http/handler';
import { HttpError } from '@/server/http/errors';
import { updateUserSettingsSchema } from '@/shared/schemas/userSettings';
import userSettingsService from '@/server/services/userSettingsService';

export const GET = createHandler({
  auth: 'session',
  handler: async ({ userId }) => {
    const userSettings = await userSettingsService.getUserSettings(userId);
    if (!userSettings) {
      throw new HttpError(404, 'User settings not found');
    }
    return {
      info: { email: userSettings.info.email },
      notifications: {
        createTransaction: userSettings.notifications.createTransaction,
        dailySummary: userSettings.notifications.dailySummary,
        subscriptionAudit: userSettings.notifications.subscriptionAudit,
        monthlyReport: userSettings.notifications.monthlyReport,
      },
      provider: {
        enabled: userSettings.provider.enabled,
        telegramChatId: userSettings.provider.telegramChatId,
      },
    };
  },
});

export const PUT = createHandler({
  auth: 'session',
  bodySchema: updateUserSettingsSchema,
  handler: async ({ userId, body }) => {
    await userSettingsService.updateUserSettings(userId, {
      info: { email: body.info.email },
      notifications: {
        createTransaction: body.notifications.createTransaction,
        dailySummary: body.notifications.dailySummary,
        subscriptionAudit: body.notifications.subscriptionAudit,
        monthlyReport: body.notifications.monthlyReport,
      },
      provider: {
        enabled: body.provider.enabled,
        chatId: body.provider.telegramChatId || null,
      },
    });
  },
});
