import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/server/db/client';
import { getValue } from '@/server/redis';
import logger from '@/server/logging/logger';

export const dynamic = 'force-dynamic';

type CheckName = 'db' | 'redis';
type CheckStatus = 'ok' | 'fail';

const NO_STORE = { 'Cache-Control': 'no-store' };

// A blackholed dependency never rejects, so without this the request would run
// into the platform timeout and the monitor would get a bodiless 504 instead of
// the 503 naming what broke.
const PROBE_TIMEOUT_MS = 5000;

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isDeepCheck(request)) {
    return NextResponse.json({ status: 'ok' }, { headers: NO_STORE });
  }

  // Only the deep check probes these: a database touch on every poll would keep
  // Neon's compute from scaling to zero and blow the free CU-hour cap.
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

// Matched by value, not presence: a stray `deep` param on the 3-minute shallow
// monitor would probe Postgres every poll and blow the CU-hour cap, so anything
// but an explicit opt-in stays shallow.
function isDeepCheck(request: NextRequest): boolean {
  const deep = request.nextUrl.searchParams.get('deep');
  return deep === '1' || deep === 'true';
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
