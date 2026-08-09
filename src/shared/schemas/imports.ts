import { z } from 'zod';
import { transactionTypeSchema } from './common';

export const processImportSchema = z.object({
  fileUrl: z.string(),
  originalFileName: z.string(),
  paymentMonth: z.string().optional(),
});
export type ProcessImportRequest = z.infer<typeof processImportSchema>;

export const getImportedTransactionsSchema = z.object({
  importId: z.string(),
});
export type GetImportedTransactionsRequest = z.infer<
  typeof getImportedTransactionsSchema
>;

export const approveImportedTransactionSchema = z.object({
  description: z.string(),
  // The original DTO had no @Type coercion here, so the value must already be
  // a number in the JSON body.
  value: z.number(),
  date: z.coerce.date(),
  type: transactionTypeSchema,
  categoryId: z.string().optional(),
});
export type ApproveImportedTransactionRequest = z.infer<
  typeof approveImportedTransactionSchema
>;

export const ignoreImportedTransactionSchema = z.object({
  transactionId: z.string(),
});
export type IgnoreImportedTransactionRequest = z.infer<
  typeof ignoreImportedTransactionSchema
>;

export const mergeImportedTransactionSchema = z.object({
  description: z.string(),
  value: z.number(),
  date: z.coerce.date(),
  type: transactionTypeSchema,
  categoryId: z.string(),
});
export type MergeImportedTransactionRequest = z.infer<
  typeof mergeImportedTransactionSchema
>;

export const batchActionSchema = z.object({
  importId: z.string(),
  transactionIds: z.array(z.string()).optional(),
  action: z.enum(['approve', 'ignore']),
});
export type BatchActionRequest = z.infer<typeof batchActionSchema>;

export const createAutoApproveRuleSchema = z.object({
  descriptionPattern: z.string(),
  categoryId: z.string(),
  type: transactionTypeSchema,
});
export type CreateAutoApproveRuleRequest = z.infer<
  typeof createAutoApproveRuleSchema
>;

export const updateAutoApproveRuleSchema = z.object({
  descriptionPattern: z.string().optional(),
  categoryId: z.string().optional(),
  type: transactionTypeSchema.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateAutoApproveRuleRequest = z.infer<
  typeof updateAutoApproveRuleSchema
>;
