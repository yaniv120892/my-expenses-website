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
  /** The model id this suggester sends, after any env override. */
  modelName(): string;
}

export interface AIProvider extends CategorySuggester {
  generateContent(prompt: string): Promise<string>;
  /**
   * Null when the provider call failed, never an apology: callers parse this,
   * and prose turns an outage into a parse error that names the wrong culprit.
   */
  analyzeExpenses(
    expenseSummary: string,
    suffixPrompt?: string,
  ): Promise<string | null>;
  /**
   * Implementations validate the answer through `resolveMatchedTransactionId`,
   * so callers never see an invented id.
   */
  findMatchingTransaction(
    importedCharge: ImportedChargeToMatch,
    potentialMatches: Transaction[],
  ): Promise<string | null>;
}
