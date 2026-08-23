import { z } from 'zod';
import { subscriptionStatusSchema } from './common';

export const subscriptionFrequencySchema = z.enum([
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
]);

export const convertSubscriptionSchema = z.object({
  categoryId: z.string().uuid().optional(),
});

export const updateSubscriptionSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    averageAmount: z.coerce.number().positive().optional(),
    frequency: subscriptionFrequencySchema.optional(),
    lastChargeDate: z.coerce.date().optional(),
    nextExpectedDate: z.coerce.date().optional(),
    // Null clears the category; undefined leaves it untouched.
    categoryId: z.string().uuid().nullable().optional(),
  })
  .refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

export const getSubscriptionsQuerySchema = z.object({
  status: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) {
        return undefined;
      }
      const parsed = subscriptionStatusSchema.safeParse(value.toUpperCase());
      return parsed.success ? parsed.data : undefined;
    }),
});
