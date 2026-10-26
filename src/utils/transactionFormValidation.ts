import { isPositiveAmount } from '@/shared/schemas/amount';
import type { TransactionValidationMessage } from './transactionFormValidation.types';

export type TransactionFormValues = {
  description: string;
  value: number | string;
  baseValue?: number | string;
  categoryId: string;
  type: string;
  date: string;
};

export type TransactionFormErrors = Partial<
  Record<keyof TransactionFormValues, TransactionValidationMessage>
>;

/**
 * Returns message keys rather than text, so the form translates them in the
 * viewer's language. Update and merge require a category uuid while create and
 * import-approve let the server categorize, so the endpoint the submit targets
 * decides `requireCategory`.
 */
export function validateTransactionForm({
  form,
  requireCategory,
}: {
  form: TransactionFormValues;
  requireCategory: boolean;
}): TransactionFormErrors {
  const errors: TransactionFormErrors = {};

  if (!form.description) {
    errors.description = 'transactions.validation.descriptionRequired';
  }
  if (isNaN(Number(form.value))) {
    errors.value = 'transactions.validation.valueNotNumber';
  } else if (!isPositiveAmount(form.value)) {
    errors.value = 'transactions.validation.valueNotPositive';
  }
  const baseValueEntered =
    form.baseValue !== undefined && form.baseValue !== '';
  if (baseValueEntered && !isPositiveAmount(form.baseValue)) {
    errors.baseValue = 'transactions.validation.baseValueInvalid';
  }
  if (!form.type) {
    errors.type = 'transactions.validation.typeRequired';
  }
  if (!form.date) {
    errors.date = 'transactions.validation.dateRequired';
  }
  if (requireCategory && !form.categoryId) {
    errors.categoryId = 'transactions.validation.categoryRequired';
  }

  return errors;
}
