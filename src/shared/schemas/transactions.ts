import { z } from 'zod';
import { transactionStatusSchema, transactionTypeSchema } from './common';
import { currencyCodeSchema } from '@/shared/currency';

// `value` alone is an ILS amount, as before currencies existed. A foreign
// amount is `originalAmount` + `currency`, with `value` (the ILS charged) or
// `exchangeRate` when the caller knows it.
const transactionAmountFields = {
  value: z.coerce.number().optional(),
  currency: currencyCodeSchema.optional(),
  originalAmount: z.coerce.number().positive().optional(),
  exchangeRate: z.coerce.number().positive().optional(),
};

function requireAnAmount(
  amount: { value?: number; originalAmount?: number },
  context: z.RefinementCtx,
) {
  const hasNoAmount =
    amount.value === undefined && amount.originalAmount === undefined;
  if (hasNoAmount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['value'],
      message: 'value or originalAmount is required',
    });
  }
}

export const createTransactionSchema = z
  .object({
    description: z.string(),
    ...transactionAmountFields,
    categoryId: z.string().uuid().optional(),
    type: transactionTypeSchema,
    date: z.coerce.date().optional(),
  })
  .superRefine(requireAnAmount);
export type CreateTransactionRequest = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = z
  .object({
    description: z.string(),
    ...transactionAmountFields,
    categoryId: z.string().uuid(),
    type: transactionTypeSchema,
    date: z.coerce.date(),
  })
  .superRefine(requireAnAmount);
export type UpdateTransactionRequest = z.infer<typeof updateTransactionSchema>;

export const updateTransactionStatusSchema = z.object({
  status: transactionStatusSchema,
});

// Shared by the list and the summary, so a filter can never narrow the rows
// without narrowing the totals shown above them.
export const transactionFilterSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  categoryId: z.string().uuid().optional(),
  type: transactionTypeSchema.optional(),
  searchTerm: z.string().optional(),
});

export const getTransactionsSummarySchema = transactionFilterSchema;

export const exportTransactionsSchema = transactionFilterSchema;

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
