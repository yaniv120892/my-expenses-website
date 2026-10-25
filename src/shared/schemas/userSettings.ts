import { z } from 'zod';

export const userSettingsInfoSchema = z.object({
  email: z.email(),
});

export const userSettingsNotificationsSchema = z.object({
  createTransaction: z.boolean(),
  dailySummary: z.boolean(),
  subscriptionAudit: z.boolean(),
  monthlyReport: z.boolean(),
});

// No provider field: a Telegram chat is bound only by the bot receiving a
// one-time `/start <code>` from it. An older client still sending
// `provider.telegramChatId` has it stripped, so its notification toggles save.
export const updateUserSettingsSchema = z.object({
  info: userSettingsInfoSchema,
  notifications: userSettingsNotificationsSchema,
});
