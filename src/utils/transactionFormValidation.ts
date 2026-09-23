export interface TransactionFormValues {
  description: string;
  value: number | string;
  categoryId: string;
  type: string;
  date: string;
}

// Update and merge require a category uuid while create and import-approve let
// the server categorize, so the endpoint the submit targets decides
// `requireCategory`.
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
