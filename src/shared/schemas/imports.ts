import { z } from 'zod';
import { transactionTypeSchema } from './common';
import { normalizePaymentMonth } from '../paymentMonth';
import { strictPositiveAmountSchema } from './amount';

export const processImportSchema = z.object({
  fileUrl: z.url(),
  originalFileName: z.string(),
  paymentMonth: z
    .string()
    .optional()
    .transform((raw, context) => {
      if (!raw?.trim()) {
        return undefined;
      }
      const paymentMonth = normalizePaymentMonth(raw);
      if (!paymentMonth) {
        context.addIssue({
          code: 'custom',
          message: `paymentMonth must be MM/YYYY (got "${raw}")`,
        });
        return z.NEVER;
      }
      return paymentMonth;
    }),
});

export const approveImportedTransactionSchema = z.object({
  description: z.string(),
  value: strictPositiveAmountSchema,
  date: z.coerce.date(),
  type: transactionTypeSchema,
  categoryId: z.string().optional(),
});

export const mergeImportedTransactionSchema = z.object({
  description: z.string(),
  value: strictPositiveAmountSchema,
  date: z.coerce.date(),
  type: transactionTypeSchema,
  categoryId: z.string(),
});

export const batchActionSchema = z.object({
  importId: z.string(),
  transactionIds: z.array(z.string()).optional(),
  action: z.enum(['approve', 'ignore']),
});

export const createAutoApproveRuleSchema = z.object({
  descriptionPattern: z.string().trim().min(1),
  categoryId: z.string(),
  type: transactionTypeSchema,
});

export const updateAutoApproveRuleSchema = z.object({
  descriptionPattern: z.string().trim().min(1).optional(),
  categoryId: z.string().optional(),
  type: transactionTypeSchema.optional(),
  isActive: z.boolean().optional(),
});
