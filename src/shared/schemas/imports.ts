import { z } from 'zod';
import { transactionTypeSchema } from './common';

export const processImportSchema = z.object({
  fileUrl: z.string().url(),
  originalFileName: z.string(),
  paymentMonth: z.string().optional(),
});

export const approveImportedTransactionSchema = z.object({
  description: z.string(),
  value: z.number(),
  date: z.coerce.date(),
  type: transactionTypeSchema,
  categoryId: z.string().optional(),
});

export const mergeImportedTransactionSchema = z.object({
  description: z.string(),
  value: z.number(),
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
  descriptionPattern: z.string(),
  categoryId: z.string(),
  type: transactionTypeSchema,
});

export const updateAutoApproveRuleSchema = z.object({
  descriptionPattern: z.string().optional(),
  categoryId: z.string().optional(),
  type: transactionTypeSchema.optional(),
  isActive: z.boolean().optional(),
});
