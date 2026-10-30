import { createHandler } from '@/server/http/handler';
import householdService from '@/server/services/householdService';

export const GET = createHandler({
  auth: 'session',
  handler: async ({ actor }) => householdService.getHousehold(actor),
});
