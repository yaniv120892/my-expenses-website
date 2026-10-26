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
import { useT } from '@/i18n/useT';
import type { T } from '@/i18n/useT.types';
import { useAppFormat, type AppFormatter } from '@/i18n/useAppFormat';
import type { TestMonthlyReportResult } from '@/shared/types/testMonthlyReport';
import { describeApiError } from '@/utils/api';

type TestNotice = { success: boolean; message: string };

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
  const t = useT();
  return useMutation({
    mutationFn: async () => {
      try {
        return await testTelegram();
      } catch (error) {
        return {
          success: false,
          message: describeApiError(error, t('settings.telegram.testFailed')),
        };
      }
    },
  });
};

export const useTestMonthlyReportMutation = () => {
  const t = useT();
  const formatter = useAppFormat();
  return useMutation({
    mutationFn: async (): Promise<TestNotice> => {
      try {
        return describeTestMonthlyReport({
          result: await testMonthlyReport(),
          t,
          formatter,
        });
      } catch (error) {
        return {
          success: false,
          message: describeApiError(
            error,
            t('settings.notifications.testReportFailed'),
          ),
        };
      }
    },
  });
};

function describeTestMonthlyReport({
  result,
  t,
  formatter,
}: {
  result: TestMonthlyReportResult;
  t: T;
  formatter: AppFormatter;
}): TestNotice {
  switch (result.status) {
    case 'SENT': {
      const variables = {
        month: formatter.month(`${result.month}-01`),
        recipient: result.recipient,
      };
      return {
        success: true,
        message:
          result.transactionCount === 0
            ? t('settings.notifications.testReportSentEmpty', variables)
            : t('settings.notifications.testReportSent', variables),
      };
    }
    case 'NOT_BUILT':
      return {
        success: false,
        message: t('settings.notifications.testReportNotBuilt'),
      };
    default:
      return {
        success: false,
        message: t('settings.notifications.testReportFailed'),
      };
  }
}
