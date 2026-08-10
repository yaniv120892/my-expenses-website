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
  suggestCategory(
    expenseDescription: string,
    categoryOptions: Category[],
    categorizerHint?: CategorizerHint,
  ): Promise<string>;
  findMatchingTransaction(
    importedDescription: string,
    potentialMatches: Transaction[],
  ): Promise<string | null>;
}
