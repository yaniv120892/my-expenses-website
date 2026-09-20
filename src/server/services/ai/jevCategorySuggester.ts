import { createGateway } from '@ai-sdk/gateway';
import { createTypeSafeAi } from '@ai-sdk/typesafe-ai';
import {
  experimental_evaluate as evaluate,
  type Experimental_EvaluationModel,
} from 'ai';
import {
  CategoryEvaluation,
  CategorySuggester,
} from '@/server/services/ai/aiProvider';
import { Category } from '@/shared/types/category';
import { lazy } from '@/server/lib/lazy';
import { AI_REQUEST_LIMITS } from '@/server/services/ai/requestLimits';
import { optionalEnv, requireEnv } from '@/server/env';
import logger from '@/server/logging/logger';
import { reportSwallowedError } from '@/server/logging/reportSwallowedError';
import {
  SUGGEST_CATEGORY_QUESTION,
  buildCategoryChoiceCriteria,
  resolveSuggestedCategoryId,
} from '@/server/services/ai/prompts';

// The same model has a different id on each route; overridable for the same
// reason as the OpenAI and Gemini ids.
export const DEFAULT_GATEWAY_JEV_MODEL = 'typesafe-ai/jev';
export const DEFAULT_TYPESAFE_JEV_MODEL = 'jev-latest';

// A pure env read, so the failure path can name the model without building a
// client.
export function defaultJevModel(): string {
  return optionalEnv('TYPESAFE_API_KEY')
    ? DEFAULT_TYPESAFE_JEV_MODEL
    : DEFAULT_GATEWAY_JEV_MODEL;
}

interface JevProvider {
  evaluationModel(modelId: string): Experimental_EvaluationModel;
}

/**
 * Routes the category decision to Jev, a non-generative model that returns a
 * probability per offered category instead of text. Only `suggestCategory` is
 * covered: the other `AIProvider` methods produce prose, which Jev cannot.
 */
export class JevCategorySuggester implements CategorySuggester {
  private getProvider = lazy((): JevProvider => {
    const typeSafeKey = optionalEnv('TYPESAFE_API_KEY');
    if (typeSafeKey) {
      return createTypeSafeAi({ apiKey: typeSafeKey });
    }
    return createGateway({ apiKey: requireEnv('AI_GATEWAY_API_KEY') });
  });

  public async suggestCategory(
    expenseDescription: string,
    categoryOptions: Category[],
  ): Promise<string | null> {
    try {
      const evaluation = await this.evaluateCategory(
        expenseDescription,
        categoryOptions,
      );
      return evaluation.categoryId;
    } catch (err) {
      reportSwallowedError({ err, model: this.modelName() }, 'Jev API error');
      return null;
    }
  }

  public async evaluateCategory(
    expenseDescription: string,
    categoryOptions: Category[],
  ): Promise<CategoryEvaluation> {
    const startedAt = Date.now();
    const result = await evaluate({
      model: this.getProvider().evaluationModel(this.modelName()),
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
    const evaluation: CategoryEvaluation = {
      categoryId: resolveSuggestedCategoryId(answer.choice, categoryOptions),
      categoryName: answer.choice,
      probability: answer.probabilities?.[answer.choice] ?? null,
      inputTokens: result.usage.inputTokens ?? null,
      outputTokens: result.usage.outputTokens ?? null,
    };
    logger.debug(
      {
        expenseDescription,
        ...evaluation,
        durationMs: Date.now() - startedAt,
        model: this.modelName(),
      },
      'Jev categorized expense',
    );
    return evaluation;
  }

  private modelName(): string {
    return optionalEnv('JEV_MODEL', defaultJevModel());
  }
}
