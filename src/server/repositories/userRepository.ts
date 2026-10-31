import type { User } from '@/generated/prisma/client';
import { NotificationProvider } from '@/generated/prisma/client';
import prisma from '@/server/db/client';
import type { HouseholdId } from '@/server/auth/householdActor.types';
import { toHouseholdId } from '@/server/auth/householdId';
import type { ReportRecipient, ScheduledReport } from '@/server/repositories/userRepository.types';

class UserRepository {
  public async findReportRecipients(report: ScheduledReport): Promise<ReportRecipient[]> {
    const members = await prisma.user.findMany({
      where: { userNotification: { [report]: true } },
      select: { id: true, householdId: true },
    });
    return members.map((member) => ({
      userId: member.id,
      householdId: toHouseholdId(member.householdId),
    }));
  }

  public async findMembersNotifiedOfNewTransactions(householdId: HouseholdId): Promise<string[]> {
    const members = await prisma.user.findMany({
      where: { householdId, userNotification: { createTransaction: true } },
      select: { id: true },
    });
    return members.map((member) => member.id);
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

  public async createUser(email: string, username: string, hashedPassword: string): Promise<User> {
    return prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        verified: false,
        household: { create: {} },
        householdRole: 'OWNER',
      },
    });
  }

  public async findByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  }

  public async verifyUser(email: string, passwordHash: string): Promise<User> {
    return prisma.user.update({
      where: { email },
      data: { verified: true, password: passwordHash },
    });
  }

  public async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { password: passwordHash } });
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
}

const userRepository = new UserRepository();
export default userRepository;
