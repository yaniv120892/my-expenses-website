import { NotificationProvider, User } from '@prisma/client';
import prisma from '@/server/db/client';
import { UserQuery } from '@/server/repositories/types';

class UserRepository {
  public async getUsersRequiredDailySummary() {
    const userNotificationPreferences =
      await prisma.userNotificationPreference.findMany({
        where: {
          dailySummary: true,
        },
        select: {
          userId: true,
        },
      });
    return userNotificationPreferences.map((user) => user.userId);
  }

  public async getUsersRequiredMonthlyReport() {
    const userNotificationPreferences =
      await prisma.userNotificationPreference.findMany({
        where: {
          monthlyReport: true,
        },
        select: {
          userId: true,
        },
      });
    return userNotificationPreferences.map((user) => user.userId);
  }

  public async isCreateTransactionNotificationEnabled(userId: string) {
    const notificationPreference =
      await prisma.userNotificationPreference.findUnique({
        where: { userId },
        select: { createTransaction: true },
      });

    return notificationPreference?.createTransaction ?? false;
  }

  public async findById(userId: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id: userId } });
  }

  public async findByEmailOrUsername(
    email: string,
    username: string,
  ): Promise<User | null> {
    return prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
  }

  public async createUser(
    email: string,
    username: string,
    hashedPassword: string,
  ): Promise<User> {
    return prisma.user.create({
      data: { email, username, password: hashedPassword, verified: false },
    });
  }

  public async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  public async verifyUser(email: string): Promise<User> {
    return prisma.user.update({
      where: { email },
      data: { verified: true },
    });
  }

  public async getUserSettings(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        userNotification: true,
        userNotificationProviders: true,
      },
    });
    if (!user) {
      return null;
    }
    return {
      info: { email: user.email },
      notifications: {
        createTransaction: user.userNotification?.createTransaction ?? false,
        dailySummary: user.userNotification?.dailySummary ?? false,
        subscriptionAudit: user.userNotification?.subscriptionAudit ?? false,
        monthlyReport: user.userNotification?.monthlyReport ?? false,
      },
      providers: user.userNotificationProviders || [],
    };
  }

  public async updateUserSettings(
    userId: string,
    notifications: {
      createTransaction: boolean;
      dailySummary: boolean;
      subscriptionAudit: boolean;
      monthlyReport: boolean;
    },
    providers: {
      provider: NotificationProvider;
      enabled: boolean;
      data: object;
    }[],
  ) {
    await prisma.userNotificationPreference.upsert({
      where: { userId: userId },
      update: {
        createTransaction: notifications.createTransaction,
        dailySummary: notifications.dailySummary,
        subscriptionAudit: notifications.subscriptionAudit,
        monthlyReport: notifications.monthlyReport,
      },
      create: {
        userId: userId,
        createTransaction: notifications.createTransaction,
        dailySummary: notifications.dailySummary,
        subscriptionAudit: notifications.subscriptionAudit,
        monthlyReport: notifications.monthlyReport,
      },
    });

    for (const provider of providers) {
      await prisma.userNotificationProvider.upsert({
        where: { userId_provider: { userId, provider: provider.provider } },
        update: {
          enabled: provider.enabled,
          data: provider.data,
        },
        create: {
          userId: userId,
          provider: provider.provider,
          enabled: provider.enabled,
          data: provider.data,
        },
      });
    }
  }

  public async list(query: UserQuery) {
    const users = await prisma.user.findMany({
      where: {
        verified: query.isVerified ? true : undefined,
      },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      username: user.username,
      verified: user.verified,
    }));
  }
}

export default new UserRepository();
