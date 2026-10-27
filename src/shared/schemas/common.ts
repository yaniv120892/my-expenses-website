import { z } from 'zod';

// Shape only: the categories the first migrations seeded carry hand-written
// ids without RFC 9562 version and variant bits, which z.uuid() rejects.
export const recordIdSchema = z.guid('Invalid uuid');

export const transactionTypeSchema = z.enum(['INCOME', 'EXPENSE']);

export const transactionStatusSchema = z.enum(['APPROVED', 'PENDING_APPROVAL']);

export const scheduleTypeSchema = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CUSTOM']);

export const subscriptionStatusSchema = z.enum(['DETECTED', 'CONFIRMED', 'DISMISSED']);

// Query params arrive as strings; z.coerce.boolean() would turn 'false' into
// true, so only the two literal forms are accepted and mapped explicitly.
export const queryBooleanSchema = z.enum(['true', 'false']).transform((value) => value === 'true');

export const idParamsSchema = z.object({ id: recordIdSchema });
export const attachmentParamsSchema = z.object({ id: recordIdSchema, fileId: recordIdSchema });
export const importIdParamsSchema = z.object({ importId: recordIdSchema });
export const importedTransactionIdParamsSchema = z.object({
  importedTransactionId: recordIdSchema,
});
export const ruleIdParamsSchema = z.object({ ruleId: recordIdSchema });
export const tokenIdParamsSchema = z.object({ tokenId: recordIdSchema });
