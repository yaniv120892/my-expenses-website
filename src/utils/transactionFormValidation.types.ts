import type { AppMessages } from '@/i18n/messages';

export type TransactionValidationMessage = Extract<
  keyof AppMessages,
  `transactions.validation.${string}`
>;
