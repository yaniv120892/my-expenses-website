import { z } from 'zod';

export const transactionTypeSchema = z.enum(['INCOME', 'EXPENSE']);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

export const transactionStatusSchema = z.enum([
  'APPROVED',
  'PENDING_APPROVAL',
]);
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;

export const scheduleTypeSchema = z.enum([
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
  'CUSTOM',
]);
export type ScheduleType = z.infer<typeof scheduleTypeSchema>;

export const subscriptionStatusSchema = z.enum([
  'DETECTED',
  'CONFIRMED',
  'DISMISSED',
]);
export type SubscriptionStatus = z.infer<typeof subscriptionStatusSchema>;

// Query params arrive as strings; z.coerce.boolean() would turn 'false' into
// true, so only the two literal forms are accepted and mapped explicitly.
export const queryBooleanSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');
