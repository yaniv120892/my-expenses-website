import { z } from 'zod';

// Shape only: the categories the first migrations seeded carry hand-written
// ids without RFC 9562 version and variant bits, which z.uuid() rejects.
export const recordIdSchema = z.guid('Invalid uuid');

export const transactionTypeSchema = z.enum(['INCOME', 'EXPENSE']);

export const transactionStatusSchema = z.enum(['APPROVED', 'PENDING_APPROVAL']);

export const scheduleTypeSchema = z.enum([
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
  'CUSTOM',
]);

export const subscriptionStatusSchema = z.enum([
  'DETECTED',
  'CONFIRMED',
  'DISMISSED',
]);

// Query params arrive as strings; z.coerce.boolean() would turn 'false' into
// true, so only the two literal forms are accepted and mapped explicitly.
export const queryBooleanSchema = z
  .enum(['true', 'false'])
  .transform((value) => value === 'true');
