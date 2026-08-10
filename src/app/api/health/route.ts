import { NextResponse } from 'next/server';
import prisma from '@/server/db/client';
import { getValue } from '@/server/redis';
import logger from '@/server/logging/logger';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      getValue('health:probe'),
    ]);
    return NextResponse.json({ status: 'ok' });
  } catch (err) {
    logger.error({ err }, 'Health check failed');
    return NextResponse.json({ status: 'unhealthy' }, { status: 503 });
  }
}
