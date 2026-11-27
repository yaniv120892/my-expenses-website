import Anthropic from '@anthropic-ai/sdk';
import type {
  AIProvider,
  CategorizedRow,
  CategoryEvaluation,
  ImportedChargeToMatch,
} from '@/server/services/ai/aiProvider';
import type {
  ExpenseAnalysisRequest,
  TransactionMatchRequest,
} from '@/server/services/ai/providerRequests';
import type { Category } from '@/shared/types/category';
import type { Transaction } from '@/shared/types/transaction';
import { lazy } from '@/server/lib/lazy';
import { AI_REQUEST_LIMITS } from '@/server/services/ai/requestLimits';
import { optionalEnv, requireEnv } from '@/server/env';
import {
  ANALYZE_EXPENSES_SYSTEM_PROMPT,
  buildAnalyzeExpensesPrompt,
  buildSuggestCategoryPrompt,
  buildFindMatchingTransactionPrompt,
  FIND_MATCHING_TRANSACTION_SYSTEM_PROMPT,
  SUGGEST_CATEGORY_SYSTEM_PROMPT,
  buildCategoryEvaluation,
  resolveMatchedTransactionId,
} from '@/server/services/ai/prompts';
import { ProviderFallback } from '@/server/services/ai/providerFallback';

// Overridable so a retired model is a dashboard edit, not a deploy.
export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-5-5';

// A model that declines on safety grounds is re-run on a fallback model inside the same call.
const SERVER_SIDE_FALLBACK_BETA = 'server-side-fallback-2026-07-01';

type ClaudeRequest = {
  prompt: string;
  system?: string;
  maxTokens: number;
};

export class ClaudeService implements AIProvider {
  private readonly errorFallback = new ProviderFallback({
    provider: 'Claude',
    modelName: () => this.modelName(),
  });

  private getClaude = lazy(
    () =>
      new Anthropic({
        apiKey: requireEnv('ANTHROPIC_API_KEY'),
        timeout: AI_REQUEST_LIMITS.timeoutMs,
        maxRetries: AI_REQUEST_LIMITS.maxRetries,
      }),
  );

  public async generateContent(prompt: string): Promise<string> {
    return this.errorFallback.orFallback({
      operation: 'generateContent',
      attempt: this.requestContent(prompt),
      fallback: '',
    });
  }

  public async analyzeExpenses(
    expenseSummary: string,
    suffixPrompt?: string,
  ): Promise<string | null> {
    return this.errorFallback.orFallback({
      operation: 'analyzeExpenses',
      attempt: this.requestAnalysis({ expenseSummary, suffixPrompt }),
      fallback: null,
    });
  }

  public async suggestCategory(
    row: CategorizedRow,
    categoryOptions: Category[],
  ): Promise<string | null> {
    return this.errorFallback.categoryIdOrNull({
      operation: 'suggestCategory',
      evaluation: this.evaluateCategory(row, categoryOptions),
    });
  }

  public async evaluateCategory(
    row: CategorizedRow,
    categoryOptions: Category[],
  ): Promise<CategoryEvaluation> {
    const message = await this.complete({
      prompt: buildSuggestCategoryPrompt(row, categoryOptions),
      system: SUGGEST_CATEGORY_SYSTEM_PROMPT,
      maxTokens: AI_REQUEST_LIMITS.thinkingCategoryMaxOutputTokens,
    });
    return buildCategoryEvaluation(this.answerLines(message), categoryOptions, {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
    });
  }

  public async findMatchingTransaction(
    importedCharge: ImportedChargeToMatch,
    potentialMatches: Transaction[],
  ): Promise<string | null> {
    return this.errorFallback.orFallback({
      operation: 'findMatchingTransaction',
      attempt: this.requestMatch({ importedCharge, potentialMatches }),
      fallback: null,
    });
  }

  public modelName(): string {
    return optionalEnv('CLAUDE_MODEL', DEFAULT_CLAUDE_MODEL);
  }

  private async requestContent(prompt: string): Promise<string> {
    const message = await this.complete({
      prompt,
      maxTokens: AI_REQUEST_LIMITS.thinkingAnswerMaxOutputTokens,
    });
    return this.answerText(message);
  }

  private async requestAnalysis({
    expenseSummary,
    suffixPrompt,
  }: ExpenseAnalysisRequest): Promise<string | null> {
    const message = await this.complete({
      prompt: buildAnalyzeExpensesPrompt(expenseSummary, suffixPrompt),
      system: ANALYZE_EXPENSES_SYSTEM_PROMPT,
      maxTokens: AI_REQUEST_LIMITS.thinkingAnswerMaxOutputTokens,
    });
    return this.answerText(message) || null;
  }

  private async requestMatch({
    importedCharge,
    potentialMatches,
  }: TransactionMatchRequest): Promise<string | null> {
    if (!potentialMatches.length) {
      return null;
    }
    const message = await this.complete({
      prompt: buildFindMatchingTransactionPrompt(importedCharge, potentialMatches),
      system: FIND_MATCHING_TRANSACTION_SYSTEM_PROMPT,
      maxTokens: AI_REQUEST_LIMITS.thinkingCategoryMaxOutputTokens,
    });
    return resolveMatchedTransactionId(this.answerLines(message), potentialMatches);
  }

  private async complete({
    prompt,
    system,
    maxTokens,
  }: ClaudeRequest): Promise<Anthropic.Beta.BetaMessage> {
    const message = await this.getClaude().beta.messages.create({
      model: this.modelName(),
      max_tokens: maxTokens,
      // These are short, bounded answers, so the least thinking that answers them is enough.
      output_config: { effort: 'low' },
      system,
      messages: [{ role: 'user', content: prompt }],
      betas: [SERVER_SIDE_FALLBACK_BETA],
      fallbacks: 'default',
    });
    this.assertAnswered(message);
    return message;
  }

  private assertAnswered(message: Anthropic.Beta.BetaMessage): void {
    if (message.stop_reason === 'refusal') {
      throw new Error(
        `Claude declined the request (message: ${message.id}, category: ${message.stop_details?.category ?? 'none'})`,
      );
    }
    const isCutBeforeAnswer = message.stop_reason === 'max_tokens' && !this.answerText(message);
    if (isCutBeforeAnswer) {
      throw new Error(`Claude hit max_tokens before answering (message: ${message.id})`);
    }
  }

  private answerText(message: Anthropic.Beta.BetaMessage): string {
    return this.textBlocksOf(message).join('').trim();
  }

  // Prose split across blocks reads as one text, but a one-value answer must not glue onto the
  // explanation block before it.
  private answerLines(message: Anthropic.Beta.BetaMessage): string {
    return this.textBlocksOf(message).join('\n').trim();
  }

  private textBlocksOf(message: Anthropic.Beta.BetaMessage): string[] {
    return message.content.filter((block) => block.type === 'text').map((block) => block.text);
  }
}
