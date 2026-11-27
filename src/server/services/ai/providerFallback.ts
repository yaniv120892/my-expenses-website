import { after } from 'next/server';
import type { AIProvider, CategoryEvaluation } from '@/server/services/ai/aiProvider';
import { logger, observability } from '@/server/observability';
import { incrementWithTtl } from '@/server/redis';
import { isOutOfCredits } from '@/server/services/ai/outOfCredits';

// The provider methods that report a failure and return a fallback; extracted from the
// interface so renaming a method breaks every report still naming the old one.
type ProviderOperation = Extract<
  keyof AIProvider,
  'generateContent' | 'analyzeExpenses' | 'suggestCategory' | 'findMatchingTransaction'
>;

type AIProviderName = 'ChatGPT' | 'Gemini' | 'Jev';

type ProviderFallbackOptions = {
  provider: AIProviderName;
  modelName: () => string;
};

type FallbackRequest<T> = {
  operation: ProviderOperation;
  attempt: Promise<T>;
  fallback: T;
};

type FailureReport = {
  error: unknown;
  operation: ProviderOperation;
};

// An empty balance fails every call until someone tops it up, so one alert a day is enough.
const CREDITS_ALERT_WINDOW_SECONDS = 24 * 60 * 60;

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
      observability.reportError({
        error: err,
        where: `${this.options.provider} API error`,
        context: { model: this.options.modelName(), operation },
      });
      if (isOutOfCredits(err)) {
        this.scheduleCreditsAlert({ error: err, operation });
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

  // The claim and the send run after the response, so neither holds the request whose call failed.
  private scheduleCreditsAlert(report: FailureReport): void {
    try {
      after(() => this.alertOnFirstClaim(report));
    } catch {
      // Outside a request scope (a script) nothing would run the hook.
      void this.alertOnFirstClaim(report);
    }
  }

  private async alertOnFirstClaim({ error, operation }: FailureReport): Promise<void> {
    const isFirstAlertInWindow = await this.claimCreditsAlert();
    if (!isFirstAlertInWindow) {
      return;
    }
    const { provider } = this.options;
    await observability.notifyOpsAlert({
      alertType: `${provider} out of credits`,
      title: `${provider} is out of credits; top up its account`,
      error,
      context: { model: this.options.modelName(), operation },
    });
  }

  // A Redis outage alerts anyway: the alerter's own hourly cap still bounds the noise.
  private async claimCreditsAlert(): Promise<boolean> {
    const { provider } = this.options;
    try {
      const count = await incrementWithTtl(
        `ai-out-of-credits-alert:${provider}`,
        CREDITS_ALERT_WINDOW_SECONDS,
      );
      return count === 1;
    } catch (err) {
      logger.warn({ err, provider }, 'AI out-of-credits alert claim failed');
      return true;
    }
  }

  private async categoryIdOf(evaluation: Promise<CategoryEvaluation>): Promise<string | null> {
    const { categoryId } = await evaluation;
    return categoryId;
  }
}
