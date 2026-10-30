import type { User } from '@/generated/prisma/client';
import { NotificationProvider } from '@/generated/prisma/client';
import prisma from '@/server/db/client';
import type { UserQuery } from '@/server/repositories/types';

class UserRepository {
  public async getUsersRequiredDailySummary() {
    const userNotificationPreferences = await prisma.userNotificationPreference.findMany({
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
    const userNotificationPreferences = await prisma.userNotificationPreference.findMany({
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
    const notificationPreference = await prisma.userNotificationPreference.findUnique({
      where: { userId },
      select: { createTransaction: true },
    });

    return notificationPreference?.createTransaction ?? false;
  }

  public async findMembership(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { householdId: true, householdRole: true, tokenVersion: true },
    });
  }

  public async findById(userId: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id: userId } });
  }

  public async findByEmailOrUsername(email: string, username: string): Promise<User | null> {
    return prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
  }

  /** A new account always opens a household of its own, as its owner. */
  public async createUser(email: string, username: string, hashedPassword: string): Promise<User> {
    return prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        verified: false,
        household: { create: {} },
      },
    });
  }

  public async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  public async verifyUser(email: string, passwordHash: string | null): Promise<User> {
    return prisma.user.update({
      where: { email },
      data: { verified: true, password: passwordHash ?? undefined },
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

  public async updateNotificationPreferences({
    userId,
    notifications,
  }: {
    userId: string;
    notifications: {
      createTransaction: boolean;
      dailySummary: boolean;
      subscriptionAudit: boolean;
      monthlyReport: boolean;
    };
  }) {
    await prisma.userNotificationPreference.upsert({
      where: { userId },
      update: {
        createTransaction: notifications.createTransaction,
        dailySummary: notifications.dailySummary,
        subscriptionAudit: notifications.subscriptionAudit,
        monthlyReport: notifications.monthlyReport,
      },
      create: {
        userId,
        createTransaction: notifications.createTransaction,
        dailySummary: notifications.dailySummary,
        subscriptionAudit: notifications.subscriptionAudit,
        monthlyReport: notifications.monthlyReport,
      },
    });
  }

  public async findTelegramProvider(userId: string) {
    return prisma.userNotificationProvider.findUnique({
      where: {
        userId_provider: { userId, provider: NotificationProvider.TELEGRAM },
      },
    });
  }

  public async setTelegramChat({ userId, chatId }: { userId: string; chatId: string | null }) {
    const provider = {
      enabled: chatId !== null,
      data: chatId === null ? {} : { chatId },
    };
    await prisma.userNotificationProvider.upsert({
      where: {
        userId_provider: { userId, provider: NotificationProvider.TELEGRAM },
      },
      update: provider,
      create: { userId, provider: NotificationProvider.TELEGRAM, ...provider },
    });
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

const userRepository = new UserRepository();
export default userRepository;
