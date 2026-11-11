import type { CategoryEvaluation } from '@/server/services/ai/aiProvider';
import { observability } from '@/server/observability';

type ReportedFallbackRequest<T> = {
  attempt: Promise<T>;
  fallback: T;
  where: string;
  model: string;
};

export async function withReportedFallback<T>({
  attempt,
  fallback,
  where,
  model,
}: ReportedFallbackRequest<T>): Promise<T> {
  try {
    return await attempt;
  } catch (err) {
    observability.reportError({ error: err, where, context: { model } });
    return fallback;
  }
}

export async function categoryIdOf(
  evaluation: Promise<CategoryEvaluation>,
): Promise<string | null> {
  const { categoryId } = await evaluation;
  return categoryId;
}
