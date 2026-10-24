import { createHandler } from '@/server/http/handler';
import { importService } from '@/server/services/importService';

export const GET = createHandler({
  auth: 'cron',
  heartbeatEnvVar: 'BETTERSTACK_HEARTBEAT_IMPORTS_FAIL_STUCK',
  handler: async () => importService.failStuckImports(),
});
