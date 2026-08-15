import { z } from 'zod';
import {
  queryBooleanSchema,
  transactionStatusSchema,
  transactionTypeSchema,
} from './common';

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

export const getTransactionsSummarySchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  categoryId: z.string().uuid().optional(),
  type: transactionTypeSchema.optional(),
});

export const getTransactionsSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  categoryId: z.string().uuid().optional(),
  type: transactionTypeSchema.optional(),
  searchTerm: z.string().optional(),
  smartSearch: queryBooleanSchema.default('true'),
  page: z.coerce.number().int().min(1),
  perPage: z.coerce.number().int().min(10).max(100),
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
