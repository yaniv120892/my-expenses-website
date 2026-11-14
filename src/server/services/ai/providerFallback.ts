import type { CategoryEvaluation } from '@/server/services/ai/aiProvider';
import { observability } from '@/server/observability';

type ProviderFallbackOptions = {
  where: string;
  modelName: () => string;
};

type FallbackRequest<T> = {
  attempt: Promise<T>;
  fallback: T;
  where?: string;
};

export class ProviderFallback {
  public constructor(private readonly options: ProviderFallbackOptions) {}

  public async orFallback<T>({ attempt, fallback, where }: FallbackRequest<T>): Promise<T> {
    try {
      return await attempt;
    } catch (err) {
      observability.reportError({
        error: err,
        where: where ?? this.options.where,
        context: { model: this.options.modelName() },
      });
      return fallback;
    }
  }

  public async categoryIdOrNull(evaluation: Promise<CategoryEvaluation>): Promise<string | null> {
    return this.orFallback({ attempt: this.categoryIdOf(evaluation), fallback: null });
  }

  private async categoryIdOf(evaluation: Promise<CategoryEvaluation>): Promise<string | null> {
    const { categoryId } = await evaluation;
    return categoryId;
  }
}
