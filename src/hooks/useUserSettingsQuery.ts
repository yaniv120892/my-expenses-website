import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUserSettings,
  updateUserSettings,
  testTelegram,
  testMonthlyReport,
  createTelegramLinkCode,
  unlinkTelegram,
} from '../services/userSettingsService';
import type { UpdateUserSettings } from '../types';

const TELEGRAM_LINK_POLL_MS = 3000;

export const userSettingsKeys = {
  all: ['userSettings'] as const,
  settings: () => [...userSettingsKeys.all, 'settings'] as const,
};

// While a link code is out, the bot can bind the chat at any moment, so the
// settings are polled until they show the chat linked.
export const useUserSettingsQuery = (
  options: { awaitingTelegramLink?: boolean } = {},
) => {
  return useQuery({
    queryKey: userSettingsKeys.settings(),
    queryFn: getUserSettings,
    refetchInterval: options.awaitingTelegramLink
      ? TELEGRAM_LINK_POLL_MS
      : false,
  });
};

export const useUpdateUserSettingsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: UpdateUserSettings) => updateUserSettings(settings),
    onSuccess: (newSettings) => {
      queryClient.setQueryData(userSettingsKeys.settings(), newSettings);
    },
  });
};

export const useCreateTelegramLinkCodeMutation = () => {
  return useMutation({ mutationFn: createTelegramLinkCode });
};

export const useUnlinkTelegramMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: unlinkTelegram,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: userSettingsKeys.settings() }),
  });
};

export const useTestTelegramMutation = () => {
  return useMutation({
    mutationFn: async () => {
      try {
        return await testTelegram();
      } catch (e) {
        return {
          success: false,
          message:
            e instanceof Error
              ? e.message
              : 'Failed to test Telegram connection',
        };
      }
    },
  });
};

export const useTestMonthlyReportMutation = () => {
  return useMutation({
    mutationFn: async () => {
      try {
        return await testMonthlyReport();
      } catch (e) {
        return {
          success: false,
          message:
            e instanceof Error ? e.message : 'Failed to send the test report',
        };
      }
    },
  });
};
