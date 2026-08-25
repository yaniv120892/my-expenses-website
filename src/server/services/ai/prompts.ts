import { Category } from '@/shared/types/category';
import { Transaction } from '@/shared/types/transaction';
import { CategorizerHint } from '@/server/services/ai/aiProvider';
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

export function buildFindMatchingTransactionPrompt(
  importedDescription: string,
  potentialMatches: Transaction[],
): string {
  return `You are a helpful assistant that matches similar transaction descriptions. Your task is to find the most semantically similar transaction from a list of potential matches.

Rules:
1. Compare the imported description with each potential match
2. Consider semantic similarity, not just exact matches
3. Account for variations in merchant names and transaction descriptions
4. Return ONLY the ID of the best matching transaction
5. If no good match is found, return "none"
6. Do not explain your choice, just return the ID or "none"

Given this imported transaction description: "${importedDescription}"

Find the best matching transaction from this list:
${potentialMatches.map((t) => `- "${t.description}" (ID: ${t.id})`).join('\n')}

Return only the ID of the best match, or "none" if no good match exists.`;
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
