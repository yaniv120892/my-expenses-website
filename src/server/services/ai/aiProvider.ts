import type { Category } from '@/shared/types/category';
import type { Transaction, TransactionType } from '@/shared/types/transaction';

export type ImportedChargeToMatch = {
  description: string;
  value: number | null;
  currency: string | null;
  originalAmount: number;
  date: Date;
  type: TransactionType;
};

export type CategoryEvaluation = {
  categoryId: string | null;
  /** The model's answer after normalization, kept even when it names no offered category. */
  categoryName: string | null;
  probability: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
};

export type CategorySuggester = {
  suggestCategory(expenseDescription: string, categoryOptions: Category[]): Promise<string | null>;
  /** Throws on provider failure, where `suggestCategory` swallows. */
  evaluateCategory(
    expenseDescription: string,
    categoryOptions: Category[],
  ): Promise<CategoryEvaluation>;
  /** The model id this suggester sends, after any env override. */
  modelName(): string;
};

export type AIProvider = {
  generateContent(prompt: string): Promise<string>;
  /**
   * Null when the provider call failed, never an apology: callers parse this,
   * and prose turns an outage into a parse error that names the wrong culprit.
   */
  analyzeExpenses(expenseSummary: string, suffixPrompt?: string): Promise<string | null>;
  /**
   * Implementations validate the answer through `resolveMatchedTransactionId`,
   * so callers never see an invented id.
   */
  findMatchingTransaction(
    importedCharge: ImportedChargeToMatch,
    potentialMatches: Transaction[],
  ): Promise<string | null>;
} & CategorySuggester;
