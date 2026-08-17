import { z } from 'zod';
import {
  differenceInCalendarDays,
  differenceInCalendarISOWeeks,
  differenceInCalendarMonths,
  differenceInCalendarYears,
} from 'date-fns';
import { transactionTypeSchema } from './common';
import {
  MAX_COMPARISON_BUCKETS,
  MAX_COMPARISON_SERIES,
  TrendPeriod,
} from '@/shared/types/trends';

export { MAX_COMPARISON_SERIES };

/** Buckets enumerateBuckets will produce for this range, without building them. */
function bucketCount(
  startDate: Date,
  endDate: Date,
  period: TrendPeriod,
): number {
  switch (period) {
    case 'daily':
      return differenceInCalendarDays(endDate, startDate) + 1;
    case 'weekly':
      return differenceInCalendarISOWeeks(endDate, startDate) + 1;
    case 'yearly':
      return differenceInCalendarYears(endDate, startDate) + 1;
    default:
      return differenceInCalendarMonths(endDate, startDate) + 1;
  }
}

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
  })
  .refine(
    (query) =>
      bucketCount(query.startDate, query.endDate, query.period) <=
      MAX_COMPARISON_BUCKETS,
    {
      message: `Range covers more than ${MAX_COMPARISON_BUCKETS} periods; shorten it or use a longer period`,
      path: ['startDate'],
    },
  );
