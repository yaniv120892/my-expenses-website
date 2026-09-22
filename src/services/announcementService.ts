import api from './api';
import { AnnouncementWithSeen } from '@/shared/types/announcement';
import { MAX_ACKNOWLEDGE_IDS } from '@/shared/schemas/announcements';

export async function getAnnouncements(): Promise<AnnouncementWithSeen[]> {
  const res = await api.get<{ announcements: AnnouncementWithSeen[] }>(
    '/api/announcements',
  );
  return res.data.announcements;
}

// The route rejects a batch over MAX_ACKNOWLEDGE_IDS, and callers pass whatever is unseen.
export async function acknowledgeAnnouncements(
  ids: string[],
): Promise<string[]> {
  const acknowledged: string[] = [];

  for (let i = 0; i < ids.length; i += MAX_ACKNOWLEDGE_IDS) {
    const batch = ids.slice(i, i + MAX_ACKNOWLEDGE_IDS);
    const res = await api.post<{ acknowledged: string[] }>(
      '/api/announcements/acknowledge',
      { ids: batch },
    );
    acknowledged.push(...res.data.acknowledged);
  }

  return acknowledged;
}
