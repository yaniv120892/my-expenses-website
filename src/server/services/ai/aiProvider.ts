import { Category } from '@/shared/types/category';
import { Transaction, TransactionType } from '@/shared/types/transaction';

export interface ImportedChargeToMatch {
  description: string;
  value: number;
  date: Date;
  type: TransactionType;
}

export interface CategoryEvaluation {
  categoryId: string | null;
  /** The model's answer after normalization, kept even when it names no offered category. */
  categoryName: string | null;
  probability: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface CategorySuggester {
  suggestCategory(
    expenseDescription: string,
    categoryOptions: Category[],
  ): Promise<string | null>;
  /** Throws on provider failure, where `suggestCategory` swallows. */
  evaluateCategory(
    expenseDescription: string,
    categoryOptions: Category[],
  ): Promise<CategoryEvaluation>;
}

export interface AIProvider extends CategorySuggester {
  generateContent(prompt: string): Promise<string>;
  /**
   * Resolves to the analysis, or null when the provider call failed. Never a
   * human-readable apology: callers parse this, and prose shaped like a result
   * turns a provider outage into a parse error that names the wrong culprit.
   */
  analyzeExpenses(
    expenseSummary: string,
    suffixPrompt?: string,
  ): Promise<string | null>;
  /**
   * Resolves to the id of one of `potentialMatches`, or null. Implementations
   * validate the model's free-text answer through
   * `resolveMatchedTransactionId`, so callers never see an invented id.
   */
  findMatchingTransaction(
    importedCharge: ImportedChargeToMatch,
    potentialMatches: Transaction[],
  ): Promise<string | null>;
}
