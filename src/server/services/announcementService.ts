import announcementRepository from '@/server/repositories/announcementRepository';
import { ANNOUNCEMENTS, ANNOUNCEMENT_IDS } from '@/shared/announcements';
import { AnnouncementWithSeen } from '@/shared/types/announcement';
import logger from '@/server/logging/logger';

class AnnouncementService {
  public async getForUser(userId: string): Promise<AnnouncementWithSeen[]> {
    const acknowledged = new Set(
      await announcementRepository.getAcknowledgedIds(userId),
    );

    return ANNOUNCEMENTS.map((announcement) => ({
      ...announcement,
      seen: acknowledged.has(announcement.id),
    }));
  }

  public async acknowledge(userId: string, ids: string[]): Promise<string[]> {
    // Filtered against the known ids so the endpoint cannot be used to write
    // arbitrary rows.
    const known = ids.filter((id) => ANNOUNCEMENT_IDS.includes(id));
    await announcementRepository.acknowledge(userId, known);
    return known;
  }

  /**
   * A brand new account should not be told what is "new" — everything shipped
   * before it existed is acknowledged up front. This is exact, unlike a
   * date comparison, which `User` has no createdAt column to support.
   */
  public async acknowledgeAllForNewUser(userId: string): Promise<void> {
    try {
      await announcementRepository.acknowledge(userId, ANNOUNCEMENT_IDS);
    } catch (err) {
      // Never fail a signup over an announcement.
      logger.error({ err, userId }, 'Failed to seed announcement acks');
    }
  }
}

export default new AnnouncementService();
