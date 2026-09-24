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
  buildCategoryLevelCriteria,
} from '@/server/services/ai/prompts';
import {
  childCategories,
  topLevelCategories,
} from '@/server/services/ai/categoryTree';
import { suggestCategoryOrNull } from '@/server/services/ai/suggestCategoryOrNull';

/** `two-step` picks a parent category first, then refines within it. */
export type JevStrategy = 'flat' | 'two-step';

interface JevChoice {
  categoryName: string | null;
  probability: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
}

interface JevProvider {
  evaluationModel(modelId: string): Experimental_EvaluationModel;
}

// The same model has a different id on each route.
const DEFAULT_GATEWAY_JEV_MODEL = 'typesafe-ai/jev';
const DEFAULT_TYPESAFE_JEV_MODEL = 'jev-latest';

// Jev returns a probability per offered category instead of text, so it can
// make the category decision but none of the prose-producing AIProvider calls.
export class JevCategorySuggester implements CategorySuggester {
  constructor(public readonly strategy: JevStrategy = 'flat') {}

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
    // One signal spans every call and retry, so the whole decision stays
    // under timeoutMs where OpenAI's client allows it per attempt.
    const abortSignal = AbortSignal.timeout(AI_REQUEST_LIMITS.timeoutMs);
    const choice =
      this.strategy === 'two-step'
        ? await this.chooseTopDown(
            expenseDescription,
            categoryOptions,
            abortSignal,
          )
        : await this.choose(
            expenseDescription,
            buildCategoryChoiceCriteria(categoryOptions),
            abortSignal,
          );

    const evaluation = buildCategoryEvaluation(
      choice.categoryName,
      categoryOptions,
      choice,
    );
    logger.debug(
      {
        expenseDescription,
        categoryName: evaluation.categoryName,
        probability: evaluation.probability,
        model: this.modelName(),
        strategy: this.strategy,
      },
      'Jev categorized expense',
    );
    return evaluation;
  }

  /**
   * Parent first, then among that parent and its children, until the answer
   * has no children or is the parent itself. The probability is the product of
   * the steps, so it stays comparable with a flat decision's.
   */
  private async chooseTopDown(
    expenseDescription: string,
    categoryOptions: Category[],
    abortSignal: AbortSignal,
  ): Promise<JevChoice> {
    let level = topLevelCategories(categoryOptions);
    let criteria = buildCategoryLevelCriteria(level, categoryOptions);
    const refined = new Set<string>();
    let decision: JevChoice = {
      categoryName: null,
      probability: 1,
      inputTokens: 0,
      outputTokens: 0,
    };
    for (;;) {
      const step = await this.choose(expenseDescription, criteria, abortSignal);
      decision = {
        categoryName: step.categoryName,
        probability: multiplyOrNull(decision.probability, step.probability),
        inputTokens: addOrNull(decision.inputTokens, step.inputTokens),
        outputTokens: addOrNull(decision.outputTokens, step.outputTokens),
      };
      const chosen = level.find(
        (category) => category.name === step.categoryName,
      );
      // `refined` also ends the walk on a parent cycle in bad data.
      if (!chosen || refined.has(chosen.id)) {
        return decision;
      }
      const children = childCategories(categoryOptions, chosen.id);
      if (children.length === 0) {
        return decision;
      }
      refined.add(chosen.id);
      level = [chosen, ...children];
      criteria = buildCategoryLevelCriteria(level, categoryOptions, chosen);
    }
  }

  private async choose(
    expenseDescription: string,
    criteria: Record<string, string | null>,
    abortSignal: AbortSignal,
  ): Promise<JevChoice> {
    const evaluate = await this.getEvaluate();
    const provider = await this.getProvider();
    const result = await evaluate({
      model: provider.evaluationModel(this.modelName()),
      state: { expenseDescription },
      questions: {
        category: {
          type: 'choice',
          instructions: SUGGEST_CATEGORY_QUESTION,
          criteria,
        },
      },
      maxRetries: AI_REQUEST_LIMITS.maxRetries,
      abortSignal,
    });
    const answer = result.answers.category;
    return {
      categoryName: answer.choice,
      probability: answer.probabilities?.[answer.choice] ?? null,
      inputTokens: result.usage.inputTokens ?? null,
      outputTokens: result.usage.outputTokens ?? null,
    };
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

function multiplyOrNull(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a * b;
}

function addOrNull(a: number | null, b: number | null): number | null {
  return a === null || b === null ? null : a + b;
}
