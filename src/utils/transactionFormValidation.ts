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
 * `requireCategory` exists because the API schemas disagree on it: update and
 * merge require a uuid, while create and import-approve leave it optional and
 * let the server categorize. Submitting the strict ones without a category is
 * a 400, so the form has to hold that rule — but only for those submits, which
 * is a property of the target endpoint, not of "this form has initial data".
 */
export function validateTransactionForm(
  form: TransactionFormValues,
  requireCategory: boolean,
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
  if (requireCategory && !form.categoryId) {
    errors.categoryId = 'Category is required';
  }

  return errors;
}
