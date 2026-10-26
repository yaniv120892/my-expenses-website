import type { AppMessages } from '@/i18n/messages';

export type TransactionValidationMessage = Extract<
  keyof AppMessages,
  `transactions.validation.${string}`
>;

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
