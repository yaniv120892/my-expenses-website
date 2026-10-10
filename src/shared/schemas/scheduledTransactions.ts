import { z } from 'zod';
import { scheduleTypeSchema, transactionTypeSchema } from './common';
import {
  isUsableBankDescriptionPrefix,
  MINIMUM_BANK_DESCRIPTION_PREFIX_LENGTH,
} from '@/shared/descriptions';

const scheduledCombinationMessage =
  'Invalid combination of scheduleType, dayOfWeek, and dayOfMonth';

const hasValidScheduledCombination = (data: {
  scheduleType: z.infer<typeof scheduleTypeSchema>;
  dayOfWeek?: number;
  dayOfMonth?: number;
}): boolean => {
  if (data.scheduleType === 'WEEKLY') {
    return data.dayOfWeek !== undefined && data.dayOfMonth === undefined;
  }
  if (data.scheduleType === 'MONTHLY') {
    return data.dayOfMonth !== undefined && data.dayOfWeek === undefined;
  }
  return data.dayOfWeek === undefined && data.dayOfMonth === undefined;
};

const scheduledTransactionBaseSchema = z.object({
  description: z.string(),
  value: z.coerce.number(),
  type: transactionTypeSchema,
  categoryId: z.string().uuid(),
  scheduleType: scheduleTypeSchema,
  interval: z.coerce.number().optional(),
  dayOfWeek: z.coerce.number().optional(),
  dayOfMonth: z.coerce.number().optional(),
  monthOfYear: z.coerce.number().optional(),
  // A blank field clears the prefix, so the form can send what it shows.
  bankDescriptionPrefix: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    z
      .string()
      .trim()
      .max(100)
      .refine(isUsableBankDescriptionPrefix, {
        message: `Needs at least ${MINIMUM_BANK_DESCRIPTION_PREFIX_LENGTH} letters or digits`,
      })
      .optional(),
  ),
});

export const createScheduledTransactionSchema =
  scheduledTransactionBaseSchema.refine(hasValidScheduledCombination, {
    message: scheduledCombinationMessage,
  });

export const updateScheduledTransactionSchema =
  createScheduledTransactionSchema;
