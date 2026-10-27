import { z } from 'zod';
import { transactionTypeSchema } from '@/shared/schemas/common';
import { TREND_PERIODS } from '@/shared/types/trends';

export const transactionFilterShape = {
  startDate: z.string().optional().describe('Inclusive start date in YYYY-MM-DD format'),
  endDate: z.string().optional().describe('Inclusive end date in YYYY-MM-DD format'),
  categoryName: z
    .string()
    .optional()
    .describe('Category name, exactly as the category list returns it'),
  transactionType: transactionTypeSchema.optional().describe('Restrict to income or expenses'),
  searchTerm: z
    .string()
    .optional()
    .describe('Free-text term matched against the transaction description'),
};

export const transactionFilterSchema = z.object(transactionFilterShape);

export const summaryAggregationSchema = z
  .enum(['total', 'average', 'count', 'breakdown_by_category', 'breakdown_by_month', 'min_max'])
  .describe('Which figure to compute');

function periodSchema(exampleLabel: string) {
  return z.object({
    label: z.string().describe(`Short human label, e.g. "${exampleLabel}"`),
    startDate: z.string().describe('Inclusive start date, YYYY-MM-DD'),
    endDate: z.string().describe('Inclusive end date, YYYY-MM-DD'),
  });
}

export const comparePeriodsShape = {
  periodA: periodSchema('January 2026'),
  periodB: periodSchema('February 2026'),
  categoryName: z.string().optional().describe('Restrict both periods to this category'),
  transactionType: transactionTypeSchema
    .optional()
    .describe('Restrict both periods to income or expenses'),
};

export const comparePeriodsSchema = z.object(comparePeriodsShape);

export const spendingTrendsShape = {
  period: z.enum(TREND_PERIODS).describe('Granularity of the trend points'),
  startDate: z.string().optional().describe('Start date, YYYY-MM-DD'),
  endDate: z.string().optional().describe('End date, YYYY-MM-DD'),
  categoryName: z.string().optional().describe('Restrict the trend to a single category'),
  transactionType: transactionTypeSchema.optional(),
  byCategory: z.boolean().optional().describe('Set true to break the trend down per category'),
};

export const spendingTrendsSchema = z.object(spendingTrendsShape);

export const summaryOutputSchema = z.object({
  summary: z.string(),
  transactionCount: z.number(),
  resolvedCategory: z
    .string()
    .nullable()
    .describe('The category the figures actually cover, or null when unfiltered'),
});

export const trendOutputSchema = z.object({
  summary: z.string(),
  resolvedCategory: z.string().nullable(),
});
