import { logger, observability } from '@/server/observability';
import type { ProductEvent } from '@/server/productEvents.types';

/**
 * The one way the app records a product event. `userId` is the internal user id; no event
 * carries an email, a name, an amount or a description.
 */
export function captureProductEvent(userId: string, productEvent: ProductEvent): void {
  try {
    observability.captureEvent({ userId, ...productEvent });
  } catch (error) {
    logger.warn({ err: error, userId, event: productEvent.event }, 'Product event not captured');
  }
}
