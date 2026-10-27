import { observability } from '@/server/observability';

export const dynamic = 'force-dynamic';

// Liveness only: a dependency call here would keep Neon's compute from scaling
// to zero. The dependency probes live at /api/health/deep.
export const GET = observability.healthRoute;
