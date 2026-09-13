import { Category } from '@/shared/types/category';
import { Transaction } from '@/shared/types/transaction';
import {
  CategorizerHint,
  ImportedChargeToMatch,
} from '@/server/services/ai/aiProvider';
import { toDayString } from '@/shared/dates';
import { formatCurrencyPlain } from '@/utils/format';
import logger from '@/server/logging/logger';

// Prompts live here so both providers send identical instructions; switching
// AI_PROVIDER must never change product behavior.

export function buildAnalyzeExpensesPrompt(
  expenseSummary: string,
  suffixPrompt?: string,
): string {
  return `Analyze my recent expenses:\n\n${expenseSummary}, all expenses are in NIS, response in hebrew, no more than 2 sentences, add new line after each sentence, ${suffixPrompt}`;
}

export function buildSuggestCategoryPrompt(
  expenseDescription: string,
  categoryOptions: Category[],
  categorizerHint?: CategorizerHint,
): string {
  let prompt = `Which category does this expense belong to?\n\n"${expenseDescription}"\n\nAvailable categories:\n${categoryOptions.map((c) => `- ${c.name}`).join('\n')}`;

  if (categorizerHint) {
    prompt += `\n\nA machine learning model suggested "${categorizerHint.hint}" with ${Math.round(categorizerHint.confidence * 100)}% confidence. Consider this suggestion but use your own judgment.`;
  }

  prompt += '\n\nReturn only the category name, nothing else.';
  return prompt;
}

// Without rule 1 and the single-candidate "none", a lone same-value candidate
// reads as the answer and an unrelated recurring bill gets merged.
export const FIND_MATCHING_TRANSACTION_SYSTEM_PROMPT = `You decide whether an imported credit-card statement row is the same real-world charge as one of the user's existing transactions.

Rules:
1. The existing transactions are only nearby candidates in amount and date. A similar amount or date is never enough to call one a match.
2. A transaction matches only when its description names the same merchant or payee, for the same kind of charge, as the imported row. Use its category to understand what it is. A card or bank fee, a phone or utility bill, a shop purchase and a subscription are different kinds of charge.
3. Card statements shorten, truncate or transliterate merchant names between Hebrew and English, and add branch, city or reference codes: "AMZN MKTP US*2K4" is Amazon, and "רמי לוי" is "רמי לוי שיווק השקמה". Treat such variants as the same merchant.
4. Status PENDING_APPROVAL marks an expected charge the user has not confirmed, often a scheduled recurring bill. It does not make a transaction more likely to match.
5. Answer "none" whenever no transaction is clearly the same charge, including when only one is listed. A bank transfer fee next to a pending electricity bill of a similar amount is "none".

Respond with only the matching transaction ID, or "none". Do not explain.`;

export function buildFindMatchingTransactionPrompt(
  importedCharge: ImportedChargeToMatch,
  potentialMatches: Transaction[],
): string {
  return `Imported row:
- description: ${JSON.stringify(importedCharge.description)}
- amount: ${formatCurrencyPlain(importedCharge.value)}
- date: ${toDayString(importedCharge.date)}
- type: ${importedCharge.type}

Existing transactions:
${potentialMatches.map(describeCandidate).join('\n')}`;
}

/**
 * Normalizes the model's free-text answer to buildFindMatchingTransactionPrompt:
 * an id is returned only when it names one of the offered matches, so a
 * hallucinated or prompt-injected id can never leave the provider. Idempotent,
 * so callers may re-apply it to enforce the contract structurally.
 */
export function resolveMatchedTransactionId(
  rawAnswer: string | null | undefined,
  potentialMatches: Transaction[],
): string | null {
  const answer = rawAnswer?.trim().replace(/^["']|["']$/g, '');
  if (!answer || answer === 'none') {
    return null;
  }
  if (potentialMatches.some((match) => match.id === answer)) {
    return answer;
  }
  // warn ships to Better Stack: a match rate silently dropping to zero from
  // prompt drift or injection must stay diagnosable past Vercel's log window.
  logger.warn(
    { rawAnswer },
    'Model answer did not name an offered match; treating as no match',
  );
  return null;
}

function describeCandidate(transaction: Transaction): string {
  return `- ID: ${transaction.id} | description: ${JSON.stringify(transaction.description)} | amount: ${formatCurrencyPlain(transaction.value)} | date: ${toDayString(transaction.date)} | category: ${JSON.stringify(transaction.category.name)} | status: ${transaction.status}`;
}
