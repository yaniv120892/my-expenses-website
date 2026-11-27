import prisma, { CONNECTION_WAIT_MS } from '@/server/db/client';
import { getValue } from '@/server/redis';
import { observability } from '@/server/observability';

export const dynamic = 'force-dynamic';

// A database waking from suspend can take several seconds to accept a connection, and real
// requests wait CONNECTION_WAIT_MS for one, so the probe waits that long too plus the query.
const PROBE_TIMEOUT_MS = CONNECTION_WAIT_MS + 2_000;

// Every probe wakes a scale-to-zero database, so the route is public but its
// probes are not: within the package's 60s window every call on this instance
// gets the last outcome, failures included. See README "Do not shorten the deep
// interval".
export const GET = observability.createDeepHealthRoute({
  probes: {
    db: () => prisma.$queryRaw`SELECT 1`,
    redis: () => getValue('health:probe'),
  },
  probeTimeoutMs: PROBE_TIMEOUT_MS,
});
