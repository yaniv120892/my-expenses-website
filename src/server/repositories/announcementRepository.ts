import prisma from '@/server/db/client';

class AnnouncementRepository {
  public async getAcknowledgedIds(userId: string): Promise<string[]> {
    const acks = await prisma.announcementAck.findMany({
      where: { userId },
      select: { announcementId: true },
    });
    return acks.map((ack) => ack.announcementId);
  }

  public async acknowledge(userId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return;
    }
    await prisma.announcementAck.createMany({
      data: ids.map((announcementId) => ({ userId, announcementId })),
      skipDuplicates: true,
    });
  }
}

export default new AnnouncementRepository();
