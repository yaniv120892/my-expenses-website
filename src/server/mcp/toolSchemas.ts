// zod/v4 to match the assistant's shared query schemas, which these extend.
import { z } from 'zod/v4';
import { transactionFilterShape } from '@/server/services/assistant/financeQuerySchemas';
import { BASE_CURRENCY, isIsoCurrencyCode } from '@/shared/currency';

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const transactionId = z
  .string()
  .uuid()
  .describe('The transaction id, as find_transactions returns it');

const currencyCode = z
  .string()
  .trim()
  .toUpperCase()
  .refine(isIsoCurrencyCode, 'Must be an ISO 4217 code, such as ILS or USD')
  .describe(
    `ISO 4217 code of the currency the amount was paid in. Defaults to ${BASE_CURRENCY}; set it only when the user names another currency (dollars → USD, euros → EUR).`,
  );

const ilsAmount = z
  .number()
  .positive()
  .describe(
    `Only for a foreign-currency charge, and only when the user knows what was billed in ${BASE_CURRENCY}. Otherwise the official exchange rate for the date is used.`,
  );

const categoryName = z
  .string()
  .min(1)
  .describe(
    'Exact name from list_categories. Omit it to let My Expenses pick the category from the description, which is usually right.',
  );

export const findTransactionsShape = {
  ...transactionFilterShape,
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
  amount: z
    .number()
    .positive()
    .describe('The amount paid or received, in `currency`. Always positive.'),
  type: z
    .enum(['EXPENSE', 'INCOME'])
    .default('EXPENSE')
    .describe(
      'EXPENSE for money spent (the default), INCOME for money received',
    ),
  currency: currencyCode.optional(),
  ilsAmount: ilsAmount.optional(),
  date: dayString
    .optional()
    .describe('Day of the transaction, YYYY-MM-DD. Defaults to today.'),
  categoryName: categoryName.optional(),
};

export const updateTransactionShape = {
  id: transactionId,
  description: addTransactionShape.description.optional(),
  amount: z
    .number()
    .positive()
    .optional()
    .describe(
      "New amount, in the transaction's own currency unless `currency` is also given",
    ),
  type: z.enum(['EXPENSE', 'INCOME']).optional(),
  currency: currencyCode.optional(),
  ilsAmount: ilsAmount.optional(),
  date: dayString.optional().describe('New day, YYYY-MM-DD'),
  categoryName: categoryName.optional(),
};

export const deleteTransactionShape = { id: transactionId };

export const findTransactionsSchema = z.object(findTransactionsShape);
export const addTransactionSchema = z.object(addTransactionShape);
export const updateTransactionSchema = z.object(updateTransactionShape);
export const deleteTransactionSchema = z.object(deleteTransactionShape);
