import type { AIProvider, CategoryEvaluation } from '@/server/services/ai/aiProvider';
import { observability } from '@/server/observability';
import { scheduleCreditsAlert } from '@/server/services/ai/creditsAlert';
import type { AIProviderName } from '@/server/services/ai/creditsAlert.types';
import { isOutOfCredits } from '@/server/services/ai/outOfCredits';

// The provider methods that report a failure and return a fallback; extracted from the
// interface so renaming a method breaks every report still naming the old one.
type ProviderOperation = Extract<
  keyof AIProvider,
  'generateContent' | 'analyzeExpenses' | 'suggestCategory' | 'findMatchingTransaction'
>;

type ProviderFallbackOptions = {
  provider: AIProviderName;
  modelName: () => string;
};

type FallbackRequest<T> = {
  operation: ProviderOperation;
  attempt: Promise<T>;
  fallback: T;
};

type CategoryIdRequest = {
  operation: ProviderOperation;
  evaluation: Promise<CategoryEvaluation>;
};

export class ProviderFallback {
  public constructor(private readonly options: ProviderFallbackOptions) {}

  public async orFallback<T>({ operation, attempt, fallback }: FallbackRequest<T>): Promise<T> {
    try {
      return await attempt;
    } catch (err) {
      const context = { model: this.options.modelName(), operation };
      observability.reportError({
        error: err,
        where: `${this.options.provider} API error`,
        context,
      });
      if (isOutOfCredits(err)) {
        scheduleCreditsAlert({ provider: this.options.provider, error: err, context });
      }
      return fallback;
    }
  }

  public async categoryIdOrNull({
    operation,
    evaluation,
  }: CategoryIdRequest): Promise<string | null> {
    return this.orFallback({ operation, attempt: this.categoryIdOf(evaluation), fallback: null });
  }

  private async categoryIdOf(evaluation: Promise<CategoryEvaluation>): Promise<string | null> {
    const { categoryId } = await evaluation;
    return categoryId;
  }
}
