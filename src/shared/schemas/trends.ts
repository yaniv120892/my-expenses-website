import { z } from 'zod';
import { transactionTypeSchema } from './common';
import { MAX_COMPARISON_SERIES } from '@/shared/types/trends';

export { MAX_COMPARISON_SERIES };

export const trendPeriodSchema = z.enum([
  'daily',
  'weekly',
  'monthly',
  'yearly',
]);

export const getSpendingTrendsQuerySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  period: trendPeriodSchema.default('monthly'),
  categoryId: z.string().optional(),
  transactionType: transactionTypeSchema.optional(),
});

// Category trends accept the same query shape; categoryId is simply ignored.
export const getCategorySpendingTrendsQuerySchema =
  getSpendingTrendsQuerySchema;

export const comparisonScopeSchema = z.enum(['SUBTREE', 'EXACT']);

// createHandler flattens searchParams with Object.fromEntries, which keeps only
// the last value of a repeated key. The ids must therefore arrive as a single
// comma-separated value, not as repeated categoryIds params.
const categoryIdListSchema = z
  .string()
  .transform((raw) =>
    raw
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string().uuid()).min(1).max(MAX_COMPARISON_SERIES));

export const getCategoryComparisonQuerySchema = z
  .object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    period: trendPeriodSchema.default('monthly'),
    categoryIds: categoryIdListSchema,
    scope: comparisonScopeSchema.default('SUBTREE'),
    transactionType: transactionTypeSchema.optional(),
  })
  .refine((query) => query.startDate <= query.endDate, {
    message: 'startDate must not be after endDate',
    path: ['startDate'],
  });
