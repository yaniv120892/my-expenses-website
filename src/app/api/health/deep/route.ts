import { NextResponse, after } from 'next/server';
import prisma from '@/server/db/client';
import { getValue } from '@/server/redis';
import logger from '@/server/logging/logger';
import { flushRemoteLogs } from '@/server/logging/betterStackStream';

export const dynamic = 'force-dynamic';

type CheckName = 'db' | 'redis';
type CheckStatus = 'ok' | 'fail';

const NO_STORE = { 'Cache-Control': 'no-store' };

// A blackholed dependency never rejects, so without this the request would run
// into the platform timeout and the monitor would get a bodiless 504 instead of
// the 503 naming what broke.
const PROBE_TIMEOUT_MS = 5000;

// Every call wakes Neon's compute, so nothing may poll this faster than hourly
// — see README "Do not lower the deep interval".
export async function GET(): Promise<NextResponse> {
  // Bypasses createHandler, so it must drain the remote log buffer itself —
  // otherwise a failed probe's own error sits unshipped.
  after(() => flushRemoteLogs());
  const [db, redis] = await Promise.all([
    probe('db', () => prisma.$queryRaw`SELECT 1`),
    probe('redis', () => getValue('health:probe')),
  ]);
  const healthy = db === 'ok' && redis === 'ok';

  return NextResponse.json(
    { status: healthy ? 'ok' : 'unhealthy', checks: { db, redis } },
    { status: healthy ? 200 : 503, headers: NO_STORE },
  );
}

async function probe(
  name: CheckName,
  run: () => Promise<unknown>,
): Promise<CheckStatus> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      run(),
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`Timed out after ${PROBE_TIMEOUT_MS}ms`)),
          PROBE_TIMEOUT_MS,
        );
      }),
    ]);
    return 'ok';
  } catch (err) {
    logger.error({ err, check: name }, 'Health check failed');
    return 'fail';
  } finally {
    clearTimeout(timer);
  }
}
