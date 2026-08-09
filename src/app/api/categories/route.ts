import { createHandler } from '@/server/http/handler';
import categoryService from '@/server/services/categoryService';

export const GET = createHandler({
  auth: 'session',
  handler: async () => categoryService.list(),
});
