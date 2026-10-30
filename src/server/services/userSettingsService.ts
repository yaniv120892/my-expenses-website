import type { HouseholdId } from '@/server/auth/householdActor.types';
import {
  NotificationProvider,
  type Prisma,
  type UserNotificationProvider,
} from '@/generated/prisma/client';
import userRepository from '@/server/repositories/userRepository';
import type { UpdateUserSettings, UserSettingsView } from '@/shared/types/userSettings';

class UserSettingsService {
  public getUsersRequiredDailySummary() {
    return userRepository.getUsersRequiredDailySummary();
  }

  public getUsersRequiredMonthlyReport() {
    return userRepository.getUsersRequiredMonthlyReport();
  }

  public async findMembersNotifiedOfNewTransactions(householdId: HouseholdId): Promise<string[]> {
    return userRepository.findMembersNotifiedOfNewTransactions(householdId);
  }

  public async getUserSettings(userId: string): Promise<UserSettingsView | null> {
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
        telegramLinked:
          this.linkedChatId(
            userSettings.providers.find(
              (provider) => provider.provider === NotificationProvider.TELEGRAM,
            ),
          ) !== null,
      },
    };
  }

  public async getLinkedTelegramChatId(userId: string): Promise<string | null> {
    return this.linkedChatId(await userRepository.findTelegramProvider(userId));
  }

  public async updateUserSettings(userId: string, settings: UpdateUserSettings) {
    await userRepository.updateNotificationPreferences({
      userId,
      notifications: settings.notifications,
    });
  }

  private linkedChatId(provider: UserNotificationProvider | null | undefined): string | null {
    return provider?.enabled ? this.extractChatId(provider.data) : null;
  }

  private extractChatId(providerData: Prisma.JsonValue): string | null {
    if (providerData && typeof providerData === 'object' && 'chatId' in providerData) {
      const { chatId } = providerData;
      return chatId ? String(chatId) : null;
    }
    return null;
  }
}

const userSettingsService = new UserSettingsService();
export default userSettingsService;
