import { NextResponse, after } from 'next/server';
import { flushRemoteLogs } from '@/server/logging/betterStackStream';

export const dynamic = 'force-dynamic';

// Liveness only: a dependency call here would keep Neon's compute from scaling
// to zero. The dependency probes live at /api/health/deep.
export async function GET(): Promise<NextResponse> {
  // Bypasses createHandler, so it drains the remote log buffer itself.
  after(() => flushRemoteLogs());
  return NextResponse.json(
    { status: 'ok' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
