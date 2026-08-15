export interface TransactionFormValues {
  description: string;
  value: number | string;
  categoryId: string;
  type: string;
  date: string;
}

/**
 * Field errors for the transaction form, keyed by field name.
 *
 * `isEdit` exists because the two API schemas disagree on the category:
 * createTransactionSchema makes it optional (the server fills it in via AI),
 * updateTransactionSchema requires a uuid. Submitting an edit without one is
 * a 400, so the form has to hold the stricter rule.
 */
export function validateTransactionForm(
  form: TransactionFormValues,
  isEdit: boolean,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!form.description) {
    errors.description = 'Description is required';
  }
  if (isNaN(Number(form.value))) {
    errors.value = 'Value must be a number';
  } else if (Number(form.value) <= 0) {
    errors.value = 'Value must be greater than 0';
  }
  if (!form.type) {
    errors.type = 'Type is required';
  }
  if (!form.date) {
    errors.date = 'Date is required';
  }
  if (isEdit && !form.categoryId) {
    errors.categoryId = 'Category is required';
  }

  return errors;
}
