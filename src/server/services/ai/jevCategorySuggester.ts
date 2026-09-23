import type { Experimental_EvaluationModel } from 'ai';
import {
  CategoryEvaluation,
  CategorySuggester,
} from '@/server/services/ai/aiProvider';
import { Category } from '@/shared/types/category';
import { lazy } from '@/server/lib/lazy';
import { AI_REQUEST_LIMITS } from '@/server/services/ai/requestLimits';
import { optionalEnv, requireEnv } from '@/server/env';
import logger from '@/server/logging/logger';
import {
  SUGGEST_CATEGORY_QUESTION,
  buildCategoryChoiceCriteria,
  buildCategoryEvaluation,
} from '@/server/services/ai/prompts';
import { suggestCategoryOrNull } from '@/server/services/ai/suggestCategoryOrNull';

interface JevProvider {
  evaluationModel(modelId: string): Experimental_EvaluationModel;
}

// The same model has a different id on each route.
const DEFAULT_GATEWAY_JEV_MODEL = 'typesafe-ai/jev';
const DEFAULT_TYPESAFE_JEV_MODEL = 'jev-latest';

// Jev returns a probability per offered category instead of text, so it can
// make the category decision but none of the prose-producing AIProvider calls.
export class JevCategorySuggester implements CategorySuggester {
  // Dynamic imports: the AI SDK costs ~110 ms at load, and every transactions
  // route imports this class whether or not the flag is on.
  private getEvaluate = lazy(async () => {
    const { experimental_evaluate } = await import('ai');
    return experimental_evaluate;
  });

  private getProvider = lazy(async (): Promise<JevProvider> => {
    if (this.usesDirectRoute()) {
      const { createTypeSafeAi } = await import('@ai-sdk/typesafe-ai');
      return createTypeSafeAi({ apiKey: requireEnv('TYPESAFE_AI_API_KEY') });
    }
    const { createGateway } = await import('@ai-sdk/gateway');
    return createGateway({ apiKey: requireEnv('AI_GATEWAY_API_KEY') });
  });

  public async suggestCategory(
    expenseDescription: string,
    categoryOptions: Category[],
  ): Promise<string | null> {
    return suggestCategoryOrNull(
      () => this.evaluateCategory(expenseDescription, categoryOptions),
      this.modelName(),
      'Jev API error',
    );
  }

  public async evaluateCategory(
    expenseDescription: string,
    categoryOptions: Category[],
  ): Promise<CategoryEvaluation> {
    // The SDK rejects an empty choice map before any I/O, which would file a
    // missing category table as a provider outage.
    if (categoryOptions.length === 0) {
      return buildCategoryEvaluation(null, categoryOptions, {
        inputTokens: null,
        outputTokens: null,
      });
    }
    const model = this.modelName();
    const evaluate = await this.getEvaluate();
    const provider = await this.getProvider();
    const result = await evaluate({
      model: provider.evaluationModel(model),
      state: { expenseDescription },
      questions: {
        category: {
          type: 'choice',
          instructions: SUGGEST_CATEGORY_QUESTION,
          criteria: buildCategoryChoiceCriteria(categoryOptions),
        },
      },
      maxRetries: AI_REQUEST_LIMITS.maxRetries,
      // One signal spans the retry too, so the whole decision stays under
      // timeoutMs where OpenAI's client allows it per attempt.
      abortSignal: AbortSignal.timeout(AI_REQUEST_LIMITS.timeoutMs),
    });

    const answer = result.answers.category;
    const evaluation = buildCategoryEvaluation(answer.choice, categoryOptions, {
      inputTokens: result.usage.inputTokens ?? null,
      outputTokens: result.usage.outputTokens ?? null,
      probability: answer.probabilities?.[answer.choice] ?? null,
    });
    logger.debug(
      {
        expenseDescription,
        categoryName: evaluation.categoryName,
        probability: evaluation.probability,
        model,
      },
      'Jev categorized expense',
    );
    return evaluation;
  }

  public modelName(): string {
    return optionalEnv(
      'JEV_MODEL',
      this.usesDirectRoute()
        ? DEFAULT_TYPESAFE_JEV_MODEL
        : DEFAULT_GATEWAY_JEV_MODEL,
    );
  }

  private usesDirectRoute(): boolean {
    return Boolean(optionalEnv('TYPESAFE_AI_API_KEY'));
  }
}
