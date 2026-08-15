import { z } from 'zod';
import { transactionStatusSchema, transactionTypeSchema } from './common';

export const createTransactionSchema = z.object({
  description: z.string(),
  value: z.coerce.number(),
  categoryId: z.string().uuid().optional(),
  type: transactionTypeSchema,
  date: z.coerce.date().optional(),
});
export type CreateTransactionRequest = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = z.object({
  description: z.string(),
  value: z.coerce.number(),
  categoryId: z.string().uuid(),
  type: transactionTypeSchema,
  date: z.coerce.date(),
});

export const updateTransactionStatusSchema = z.object({
  status: transactionStatusSchema,
});

/**
 * The filters the list and the summary must agree on. Both endpoints derive
 * from this so a filter can never narrow the rows without also narrowing the
 * totals shown above them.
 */
const transactionFilterSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  categoryId: z.string().uuid().optional(),
  type: transactionTypeSchema.optional(),
  searchTerm: z.string().optional(),
});

export const getTransactionsSummarySchema = transactionFilterSchema;

export const getTransactionsSchema = transactionFilterSchema.extend({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const attachFileSchema = z.object({
  fileName: z.string(),
  fileKey: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
});

export const getPresignedUploadUrlSchema = z.object({
  fileName: z.string(),
  mimeType: z.string(),
});
