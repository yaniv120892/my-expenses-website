import prisma from '@/server/db/client';
import { getValue } from '@/server/redis';
import { observability } from '@/server/observability';

export const dynamic = 'force-dynamic';

// Every probe wakes a scale-to-zero database, so the route is public but its
// probes are not: within the package's 60s window every call on this instance
// gets the last outcome, failures included. See README "Do not lower the deep
// interval".
export const GET = observability.createDeepHealthRoute({
  probes: {
    db: () => prisma.$queryRaw`SELECT 1`,
    redis: () => getValue('health:probe'),
  },
});
