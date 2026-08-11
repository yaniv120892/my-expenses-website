import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  acknowledgeAnnouncements,
  getAnnouncements,
} from '@/services/announcementService';
import { AnnouncementWithSeen } from '@/shared/types/announcement';

export const announcementKeys = {
  all: ['announcements'] as const,
  list: () => [...announcementKeys.all, 'list'] as const,
};

export const useAnnouncementsQuery = () =>
  useQuery({
    queryKey: announcementKeys.list(),
    queryFn: getAnnouncements,
    staleTime: 5 * 60_000,
    // An announcement is never worth retrying the app to a crawl over.
    retry: false,
  });

export const useAcknowledgeAnnouncementsMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (ids: string[]) => acknowledgeAnnouncements(ids),
    onSuccess: (acknowledged) => {
      const seen = new Set(acknowledged);
      queryClient.setQueryData<AnnouncementWithSeen[]>(
        announcementKeys.list(),
        (current) =>
          current?.map((announcement) =>
            seen.has(announcement.id)
              ? { ...announcement, seen: true }
              : announcement,
          ),
      );
    },
  });
};
