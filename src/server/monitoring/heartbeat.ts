import logger from '@/server/logging/logger';
import { optionalEnv } from '@/server/env';

const PING_TIMEOUT_MS = 5000;

// `summary-today` → BETTERSTACK_HEARTBEAT_SUMMARY_TODAY.
function envNameFor(name: string): string {
  return `BETTERSTACK_HEARTBEAT_${name.toUpperCase().replaceAll('-', '_')}`;
}

// Monitoring must never fail the run it monitors, so every failure — an unset
// URL, a rejected fetch, a non-2xx — resolves instead of throwing.
export async function pingHeartbeat(name: string): Promise<void> {
  const url = optionalEnv(envNameFor(name));
  if (!url) {
    return;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn(
        { name, status: response.status },
        'Heartbeat ping was rejected',
      );
    }
  } catch (err) {
    logger.warn({ err, name }, 'Heartbeat ping failed');
  }
}
