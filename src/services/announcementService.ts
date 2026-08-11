import api from './api';
import { AnnouncementWithSeen } from '@/shared/types/announcement';

export async function getAnnouncements(): Promise<AnnouncementWithSeen[]> {
  const res = await api.get<{ announcements: AnnouncementWithSeen[] }>(
    '/api/announcements',
  );
  return res.data.announcements;
}

export async function acknowledgeAnnouncements(
  ids: string[],
): Promise<string[]> {
  const res = await api.post<{ acknowledged: string[] }>(
    '/api/announcements/acknowledge',
    { ids },
  );
  return res.data.acknowledged;
}
