import type { Prisma } from '@/generated/prisma/client';
import userRepository from '@/server/repositories/userRepository';
import type {
  UpdateUserSettings,
  UserSettingsView,
} from '@/shared/types/userSettings';

class UserSettingsService {
  public getUsersRequiredDailySummary() {
    return userRepository.getUsersRequiredDailySummary();
  }

  public getUsersRequiredMonthlyReport() {
    return userRepository.getUsersRequiredMonthlyReport();
  }

  public async isCreateTransactionNotificationEnabled(userId: string) {
    return userRepository.isCreateTransactionNotificationEnabled(userId);
  }

  public async getUserSettings(
    userId: string,
  ): Promise<UserSettingsView | null> {
    const userSettings = await userRepository.getUserSettings(userId);
    if (!userSettings) {
      return null;
    }

    return {
      info: {
        email: userSettings.info.email,
      },
      notifications: {
        createTransaction: userSettings.notifications.createTransaction,
        dailySummary: userSettings.notifications.dailySummary,
        subscriptionAudit: userSettings.notifications.subscriptionAudit,
        monthlyReport: userSettings.notifications.monthlyReport,
      },
      provider: {
        enabled: userSettings.providers[0]?.enabled ?? false,
        telegramLinked:
          this.extractChatId(userSettings.providers[0]?.data) !== null,
      },
    };
  }

  public async getLinkedTelegramChatId(userId: string): Promise<string | null> {
    const userSettings = await userRepository.getUserSettings(userId);
    const provider = userSettings?.providers[0];
    return provider?.enabled ? this.extractChatId(provider.data) : null;
  }

  public async updateUserSettings(
    userId: string,
    settings: UpdateUserSettings,
  ) {
    await userRepository.updateNotificationPreferences(
      userId,
      settings.notifications,
    );
  }

  private extractChatId(providerData: Prisma.JsonValue): string | null {
    if (
      providerData &&
      typeof providerData === 'object' &&
      'chatId' in providerData
    ) {
      const chatId = (providerData as { chatId: string }).chatId;
      return chatId ? String(chatId) : null;
    }
    return null;
  }
}

export default new UserSettingsService();
