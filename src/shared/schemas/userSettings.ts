import { z } from 'zod';

export const userSettingsInfoSchema = z.object({
  email: z.string().email(),
});
export type UserSettingsInfoDto = z.infer<typeof userSettingsInfoSchema>;

export const userSettingsNotificationsSchema = z.object({
  createTransaction: z.boolean(),
  dailySummary: z.boolean(),
  subscriptionAudit: z.boolean(),
});
export type UserSettingsNotificationsDto = z.infer<
  typeof userSettingsNotificationsSchema
>;

export const notificationProviderSchema = z.object({
  enabled: z.boolean(),
  // The DTO declared string | null; nullable() honors that declared type even
  // though the old @IsString() check would have rejected null at runtime.
  telegramChatId: z.string().nullable(),
});
export type NotificationProviderDto = z.infer<typeof notificationProviderSchema>;

export const updateUserSettingsSchema = z.object({
  info: userSettingsInfoSchema,
  notifications: userSettingsNotificationsSchema,
  provider: notificationProviderSchema,
});
export type UpdateUserSettingsRequest = z.infer<typeof updateUserSettingsSchema>;

export const userSettingsResponseSchema = updateUserSettingsSchema;
export type UserSettingsResponse = z.infer<typeof userSettingsResponseSchema>;

export const testTelegramSchema = z.object({
  chatId: z.string().min(1),
});
export type TestTelegramRequest = z.infer<typeof testTelegramSchema>;
