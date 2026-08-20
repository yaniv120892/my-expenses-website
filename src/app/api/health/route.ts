import { NextResponse, after } from 'next/server';
import { flushRemoteLogs } from '@/server/logging/betterStackStream';

export const dynamic = 'force-dynamic';

// Liveness only, and the 3-minute monitor's target: a dependency call here
// would keep Neon's compute from scaling to zero and blow the free CU-hour cap.
// The dependency probes live at /api/health/deep.
export async function GET(): Promise<NextResponse> {
  // This route bypasses createHandler, which is where every other route drains
  // the remote log buffer. Being the most frequent request, it is also the most
  // reliable drain.
  after(() => flushRemoteLogs());
  return NextResponse.json(
    { status: 'ok' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
