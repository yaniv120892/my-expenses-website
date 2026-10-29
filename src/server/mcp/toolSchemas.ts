import { z } from 'zod';
import {
  comparePeriodsShape,
  spendingTrendsShape,
  transactionFilterShape,
} from '@/server/services/assistant/financeQuerySchemas';
import { BASE_CURRENCY, isIsoCurrencyCode } from '@/shared/currency';
import { isCalendarDay } from '@/shared/dates';
import { MAXIMUM_AMOUNT, MINIMUM_AMOUNT } from '@/shared/schemas/amount';
import { recordIdSchema, transactionTypeSchema } from '@/shared/schemas/common';

// A shape-only check lets "2026-13-45" reach the database as an Invalid Date
// and "2026-02-31" roll over to March, so the day must exist.
const dayString = z.string().refine(isCalendarDay, 'Use a real calendar day as YYYY-MM-DD');

const dateBounds = {
  startDate: dayString.optional().describe('Inclusive start day, YYYY-MM-DD'),
  endDate: dayString.optional().describe('Inclusive end day, YYYY-MM-DD'),
};

const periodDays = {
  startDate: dayString.describe('Inclusive start day, YYYY-MM-DD'),
  endDate: dayString.describe('Inclusive end day, YYYY-MM-DD'),
};

const amount = z.number().min(MINIMUM_AMOUNT).max(MAXIMUM_AMOUNT);

const transactionId = recordIdSchema.describe(
  'The transaction id, as find_transactions returns it',
);

const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isIsoCurrencyCode, 'Must be an ISO 4217 code, such as ILS or USD')
  .describe(
    `ISO 4217 code of the currency the amount was paid in. Defaults to ${BASE_CURRENCY}; set it only when the user names another currency (dollars → USD, euros → EUR).`,
  );

const ilsAmount = amount.describe(
  `Only for a foreign-currency charge, and only when the user knows what was billed in ${BASE_CURRENCY}. Otherwise the official exchange rate for the date is used.`,
);

const categoryName = z
  .string()
  .min(1)
  .describe(
    'Exact name from list_categories. Omit it to let My Expenses pick the category from the description, which is usually right.',
  );

export const transactionFilterToolShape = {
  ...transactionFilterShape,
  ...dateBounds,
};

export const comparePeriodsToolShape = {
  ...comparePeriodsShape,
  periodA: comparePeriodsShape.periodA.extend(periodDays),
  periodB: comparePeriodsShape.periodB.extend(periodDays),
};

export const spendingTrendsToolShape = {
  ...spendingTrendsShape,
  ...dateBounds,
};

export const findTransactionsShape = {
  ...transactionFilterToolShape,
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(20)
    .describe('How many transactions to return, newest first'),
};

export const addTransactionShape = {
  description: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .describe(
      'What the money was for, in the words the user used (Hebrew or English), e.g. "קפה בארומה" or "Salary".',
    ),
  amount: amount.describe('The amount paid or received, in `currency`. Always positive.'),
  type: transactionTypeSchema
    .default('EXPENSE')
    .describe('EXPENSE for money spent (the default), INCOME for money received'),
  currency: currencyCode.optional(),
  ilsAmount: ilsAmount.optional(),
  date: dayString.optional().describe('Day of the transaction, YYYY-MM-DD. Defaults to today.'),
  categoryName: categoryName.optional(),
};

export const updateTransactionShape = {
  id: transactionId,
  description: addTransactionShape.description.optional(),
  amount: amount
    .optional()
    .describe("New amount, in the transaction's own currency unless `currency` is also given"),
  type: transactionTypeSchema.optional(),
  currency: currencyCode.optional(),
  ilsAmount: ilsAmount.optional(),
  date: dayString.optional().describe('New day, YYYY-MM-DD'),
  categoryName: categoryName.optional(),
};

export const deleteTransactionShape = { id: transactionId };
