import logger from '@/server/logging/logger';
import { optionalEnv } from '@/server/env';

const PING_TIMEOUT_MS = 5000;

// Monitoring must never fail the run it monitors: every failure resolves.
export async function pingHeartbeat(envVar: string): Promise<void> {
  const url = optionalEnv(envVar);
  if (!url) {
    // Logged so an unconfigured heartbeat is visible; a misspelled var name
    // shows up here rather than as a silent no-op.
    logger.info({ envVar }, 'Heartbeat not configured');
    return;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(PING_TIMEOUT_MS),
    });
    if (!response.ok) {
      logger.warn(
        { envVar, status: response.status },
        'Heartbeat ping was rejected',
      );
    }
  } catch (err) {
    logger.warn({ err, envVar }, 'Heartbeat ping failed');
  }
}
