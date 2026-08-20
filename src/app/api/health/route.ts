import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Liveness only, and the 3-minute monitor's target: a dependency call here
// would keep Neon's compute from scaling to zero and blow the free CU-hour cap.
// The dependency probes live at /api/health/deep.
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { status: 'ok' },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
