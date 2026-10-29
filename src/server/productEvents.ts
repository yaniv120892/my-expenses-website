import { logger, observability } from '@/server/observability';
import type { UserProductEvent } from '@/server/productEvents.types';

export function captureProductEvent(userEvent: UserProductEvent): void {
  try {
    observability.captureEvent(userEvent);
  } catch (error) {
    logger.warn(
      { err: error, userId: userEvent.userId, event: userEvent.event },
      'Product event not captured',
    );
  }
}
