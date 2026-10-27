import type { CategoryEvaluation } from '@/server/services/ai/aiProvider';
import { observability } from '@/server/observability';

export async function suggestCategoryOrNull(
  evaluate: () => Promise<CategoryEvaluation>,
  model: string,
  errorMessage: string,
): Promise<string | null> {
  try {
    const evaluation = await evaluate();
    return evaluation.categoryId;
  } catch (err) {
    observability.reportError({ error: err, where: errorMessage, context: { model } });
    return null;
  }
}
