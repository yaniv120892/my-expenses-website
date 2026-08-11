import { createHandler } from '@/server/http/handler';
import announcementService from '@/server/services/announcementService';
import { acknowledgeAnnouncementsSchema } from '@/shared/schemas/announcements';

export const POST = createHandler({
  auth: 'session',
  bodySchema: acknowledgeAnnouncementsSchema,
  handler: async ({ userId, body }) => ({
    acknowledged: await announcementService.acknowledge(userId, body.ids),
  }),
});
