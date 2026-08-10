import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getUserSettings,
  updateUserSettings,
  testTelegram,
  testMonthlyReport,
} from '../services/userSettingsService';
import { UserSettings } from '../types';

export const userSettingsKeys = {
  all: ['userSettings'] as const,
  settings: () => [...userSettingsKeys.all, 'settings'] as const,
};

export const useUserSettingsQuery = () => {
  return useQuery({
    queryKey: userSettingsKeys.settings(),
    queryFn: getUserSettings,
  });
};

export const useUpdateUserSettingsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (settings: Partial<UserSettings>) =>
      updateUserSettings(settings),
    onSuccess: (newSettings) => {
      queryClient.setQueryData(userSettingsKeys.settings(), newSettings);
    },
  });
};

export const useTestTelegramMutation = () => {
  return useMutation({
    mutationFn: async (chatId: string) => {
      try {
        return await testTelegram(chatId);
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
