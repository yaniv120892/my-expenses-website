import type { ImportedChargeToMatch } from '@/server/services/ai/aiProvider';
import type { Transaction } from '@/shared/types/transaction';

export type ExpenseAnalysisRequest = {
  expenseSummary: string;
  suffixPrompt: string | undefined;
};

export type TransactionMatchRequest = {
  importedCharge: ImportedChargeToMatch;
  potentialMatches: Transaction[];
};
