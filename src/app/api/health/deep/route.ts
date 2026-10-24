import { NextResponse, after } from 'next/server';
import prisma from '@/server/db/client';
import { getValue } from '@/server/redis';
import logger from '@/server/logging/logger';
import { flushRemoteLogs } from '@/server/logging/betterStackStream';

export const dynamic = 'force-dynamic';

type CheckName = 'db' | 'redis';
type CheckStatus = 'ok' | 'fail';
type DeepHealth = {
  httpStatus: number;
  body: {
    status: 'ok' | 'unhealthy';
    checks: Record<CheckName, CheckStatus>;
    checkedAt: string;
  };
};

const NO_STORE = { 'Cache-Control': 'no-store' };

// A blackholed dependency never rejects; without this the monitor gets a
// bodiless 504 instead of a 503 naming what broke.
const PROBE_TIMEOUT_MS = 5000;

// Every probe wakes Neon's compute, so a caller polling this route must not be
// able to keep it awake: within the window every call on this instance gets the
// last outcome, failures included. See README "Do not lower the deep interval".
const RESULT_TTL_MS = 60_000;

let cached: { result: DeepHealth; expiresAt: number } | undefined;
let inFlight: Promise<DeepHealth> | undefined;

export async function GET(): Promise<NextResponse> {
  // Bypasses createHandler, so it drains the remote log buffer itself.
  after(() => flushRemoteLogs());
  const { body, httpStatus } = await currentHealth();
  return NextResponse.json(body, { status: httpStatus, headers: NO_STORE });
}

async function currentHealth(): Promise<DeepHealth> {
  if (cached && Date.now() < cached.expiresAt) {
    return cached.result;
  }
  inFlight ??= checkDependencies().finally(() => {
    inFlight = undefined;
  });
  return inFlight;
}

async function checkDependencies(): Promise<DeepHealth> {
  const [db, redis] = await Promise.all([
    probe('db', () => prisma.$queryRaw`SELECT 1`),
    probe('redis', () => getValue('health:probe')),
  ]);
  const healthy = db === 'ok' && redis === 'ok';
  const result: DeepHealth = {
    httpStatus: healthy ? 200 : 503,
    body: {
      status: healthy ? 'ok' : 'unhealthy',
      checks: { db, redis },
      checkedAt: new Date().toISOString(),
    },
  };
  cached = { result, expiresAt: Date.now() + RESULT_TTL_MS };
  return result;
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
