import { createHandler } from '@/server/http/handler';
import { HttpError } from '@/server/http/errors';
import { updateUserSettingsSchema } from '@/shared/schemas/userSettings';
import userSettingsService from '@/server/services/userSettingsService';

async function loadSettings(userId: string) {
  const userSettings = await userSettingsService.getUserSettings(userId);
  if (!userSettings) {
    throw new HttpError(404, 'User settings not found');
  }
  return userSettings;
}

export const GET = createHandler({
  auth: 'session',
  handler: async ({ userId }) => loadSettings(userId),
});

// Answers with the saved settings, which the client caches as the new state.
export const PUT = createHandler({
  auth: 'session',
  bodySchema: updateUserSettingsSchema,
  handler: async ({ userId, body }) => {
    await userSettingsService.updateUserSettings(userId, body);
    return loadSettings(userId);
  },
});
