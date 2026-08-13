import { Category } from '@/shared/types/category';
import { Transaction } from '@/shared/types/transaction';

export interface CategorizerHint {
  hint: string;
  confidence: number;
}

export interface AIProvider {
  generateContent(prompt: string): Promise<string>;
  analyzeExpenses(
    expenseSummary: string,
    suffixPrompt?: string,
  ): Promise<string>;
  /** Resolves to the matched category id, or null when nothing matched. */
  suggestCategory(
    expenseDescription: string,
    categoryOptions: Category[],
    categorizerHint?: CategorizerHint,
  ): Promise<string | null>;
  findMatchingTransaction(
    importedDescription: string,
    potentialMatches: Transaction[],
  ): Promise<string | null>;
}
