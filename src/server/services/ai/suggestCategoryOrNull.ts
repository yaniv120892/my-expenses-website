import { CategoryEvaluation } from '@/server/services/ai/aiProvider';
import { reportSwallowedError } from '@/server/logging/reportSwallowedError';

/**
 * `suggestCategory` swallows where `evaluateCategory` throws; every provider's
 * wrapper is this one call, so the contract lives in one place.
 */
export async function suggestCategoryOrNull(
  evaluate: () => Promise<CategoryEvaluation>,
  model: string,
  errorMessage: string,
): Promise<string | null> {
  try {
    const evaluation = await evaluate();
    return evaluation.categoryId;
  } catch (err) {
    reportSwallowedError({ err, model }, errorMessage);
    return null;
  }
}
