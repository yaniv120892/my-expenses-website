import { z } from 'zod';

export const userSettingsInfoSchema = z.object({
  email: z.string().email(),
});

export const userSettingsNotificationsSchema = z.object({
  createTransaction: z.boolean(),
  dailySummary: z.boolean(),
  subscriptionAudit: z.boolean(),
  monthlyReport: z.boolean(),
});

export const notificationProviderSchema = z.object({
  enabled: z.boolean(),
  // The DTO declared string | null; nullable() honors that declared type even
  // though the old @IsString() check would have rejected null at runtime.
  telegramChatId: z.string().nullable(),
});

export const updateUserSettingsSchema = z.object({
  info: userSettingsInfoSchema,
  notifications: userSettingsNotificationsSchema,
  provider: notificationProviderSchema,
});

export const testTelegramSchema = z.object({
  chatId: z.string().min(1),
});
