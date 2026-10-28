import { cookies } from 'next/headers';
import { SESSION_COOKIE } from '@/server/auth/cookies';
import { verifyToken } from '@/server/auth/tokens';
import { logger } from '@/server/observability';
import { captureProductEvent } from '@/server/productEvents';
import type { AppPage } from '@/server/productEvents.types';

/**
 * Called from each page's layout rather than the page, because a layout renders when its page is
 * entered but not when the page only changes its own search params. The token gets the proxy's
 * signature check, not the Redis session lookup, so a page view never waits on Redis.
 */
export async function recordPageView(page: AppPage): Promise<void> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return;
  }
  try {
    const { userId } = await verifyToken(token);
    captureProductEvent(userId, { event: 'page_viewed', properties: { page } });
  } catch (error) {
    logger.debug({ err: error, page }, 'Page view not recorded');
  }
}
