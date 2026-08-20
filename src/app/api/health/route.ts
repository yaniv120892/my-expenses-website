import { NextResponse } from 'next/server';
import prisma from '@/server/db/client';
import { getValue } from '@/server/redis';
import logger from '@/server/logging/logger';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

// Neon Free scales to zero after 5 idle minutes and cannot be told not to, so
// touching the database on every poll would keep the compute awake 24/7 and
// blow the 100 CU-hour monthly cap. Only `?deep=1` probes dependencies.
const DEPENDENCY_CHECKS = [
  { name: 'db', run: () => prisma.$queryRaw`SELECT 1` },
  { name: 'redis', run: () => getValue('health:probe') },
] as const;

type CheckName = (typeof DEPENDENCY_CHECKS)[number]['name'];

export async function GET(request: Request): Promise<NextResponse> {
  if (!isDeepCheck(request)) {
    return NextResponse.json({ status: 'ok' }, { headers: NO_STORE });
  }

  const results = await Promise.allSettled(
    DEPENDENCY_CHECKS.map(({ run }) => run()),
  );

  const checks = {} as Record<CheckName, 'ok' | 'fail'>;
  let healthy = true;
  results.forEach((result, index) => {
    const { name } = DEPENDENCY_CHECKS[index];
    if (result.status === 'fulfilled') {
      checks[name] = 'ok';
      return;
    }
    checks[name] = 'fail';
    healthy = false;
    logger.error({ err: result.reason, check: name }, 'Health check failed');
  });

  return NextResponse.json(
    { status: healthy ? 'ok' : 'unhealthy', checks },
    { status: healthy ? 200 : 503, headers: NO_STORE },
  );
}

function isDeepCheck(request: Request): boolean {
  const deep = new URL(request.url).searchParams.get('deep');
  return deep === '1' || deep === 'true';
}
