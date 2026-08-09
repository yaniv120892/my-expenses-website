import { z } from 'zod';
import { transactionTypeSchema } from './common';

export const trendPeriodSchema = z.enum([
  'daily',
  'weekly',
  'monthly',
  'yearly',
]);
export type TrendPeriod = z.infer<typeof trendPeriodSchema>;

// The Express controller parsed these query params by hand (no DTO) and let
// invalid dates flow through as Invalid Date; here they are rejected instead.
export const getSpendingTrendsQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  period: trendPeriodSchema.default('monthly'),
  categoryId: z.string().optional(),
  transactionType: transactionTypeSchema.optional(),
});
export type GetSpendingTrendsRequest = z.infer<
  typeof getSpendingTrendsQuerySchema
>;

// Category trends accept the same query shape; categoryId is simply ignored.
export const getCategorySpendingTrendsQuerySchema =
  getSpendingTrendsQuerySchema;
