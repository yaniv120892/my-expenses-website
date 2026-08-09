import { z } from 'zod';
import { subscriptionStatusSchema } from './common';

export const convertSubscriptionSchema = z.object({
  categoryId: z.string().uuid(),
});
export type ConvertSubscriptionRequest = z.infer<
  typeof convertSubscriptionSchema
>;

// Mirrors SubscriptionController.parseStatus: case-insensitive match, and an
// unrecognized value degrades to undefined instead of failing the request.
export const getSubscriptionsQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      const parsed = subscriptionStatusSchema.safeParse(value.toUpperCase());
      return parsed.success ? parsed.data : undefined;
    }),
});
export type GetSubscriptionsQueryRequest = z.infer<
  typeof getSubscriptionsQuerySchema
>;
