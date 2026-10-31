import { createHandler } from '@/server/http/handler';
import householdService from '@/server/services/householdService';

export const POST = createHandler({
  auth: 'session',
  writes: 'ownAccount',
  handler: async ({ actor }) => {
    await householdService.leave(actor);
    return { success: true };
  },
});
