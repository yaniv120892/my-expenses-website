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
  // The Express router defaulted a missing smartSearch to true after
  // validation ran; the default lives here so callers see the same value.
  smartSearch: queryBooleanSchema.default('true'),
  page: z.coerce.number().int().min(1),
  perPage: z.coerce.number().int().min(10).max(100),
});

// The original AttachFileRequest / GetPresignedUploadUrlRequest classes had no
// class-validator decorators, so the old middleware accepted any body; these
// schemas enforce the shape the controllers always assumed.
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
