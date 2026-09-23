import { CategoryEvaluation } from '@/server/services/ai/aiProvider';
import { reportSwallowedError } from '@/server/logging/reportSwallowedError';

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
