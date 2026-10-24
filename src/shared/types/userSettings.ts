import type { z } from 'zod';
import type { updateUserSettingsSchema } from '@/shared/schemas/userSettings';

export type UpdateUserSettings = z.infer<typeof updateUserSettingsSchema>;

// The chat id itself never leaves the server; the client only needs to know
// whether one is bound.
export type UserSettingsView = UpdateUserSettings & {
  provider: { telegramLinked: boolean };
};

export type TelegramLinkCode = {
  code: string;
  command: string;
  deepLink: string | null;
  expiresInSeconds: number;
};
