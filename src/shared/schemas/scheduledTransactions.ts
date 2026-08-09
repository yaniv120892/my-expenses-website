import { z } from 'zod';
import { scheduleTypeSchema, transactionTypeSchema } from './common';

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
});

export const createScheduledTransactionSchema =
  scheduledTransactionBaseSchema.refine(hasValidScheduledCombination, {
    message: scheduledCombinationMessage,
  });
export type CreateScheduledTransactionRequest = z.infer<
  typeof createScheduledTransactionSchema
>;

export const updateScheduledTransactionSchema =
  scheduledTransactionBaseSchema.refine(hasValidScheduledCombination, {
    message: scheduledCombinationMessage,
  });
export type UpdateScheduledTransactionRequest = z.infer<
  typeof updateScheduledTransactionSchema
>;
