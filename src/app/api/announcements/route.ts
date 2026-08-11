import { createHandler } from '@/server/http/handler';
import announcementService from '@/server/services/announcementService';

export const GET = createHandler({
  auth: 'session',
  handler: async ({ userId }) => ({
    announcements: await announcementService.getForUser(userId),
  }),
});
