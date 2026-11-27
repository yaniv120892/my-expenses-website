import { after } from 'next/server';
import { observability } from '@/server/observability';
import { incrementWithTtl } from '@/server/redis';
import type { AIProviderName, CreditsAlert } from '@/server/services/ai/creditsAlert.types';

// An empty balance fails every call until someone tops it up, so one alert a day is enough.
const CREDITS_ALERT_WINDOW_SECONDS = 24 * 60 * 60;

// The claim and the send run after the response, so neither holds the request whose call failed.
export function scheduleCreditsAlert(alert: CreditsAlert): void {
  try {
    after(() => alertOnFirstClaim(alert));
  } catch {
    // Outside a request scope (a script) nothing would run the hook.
    void alertOnFirstClaim(alert);
  }
}

async function alertOnFirstClaim({ provider, error, context }: CreditsAlert): Promise<void> {
  const isFirstAlertInWindow = await claimCreditsAlert(provider);
  if (!isFirstAlertInWindow) {
    return;
  }
  await observability.notifyOpsAlert({
    alertType: `${provider} out of credits`,
    title: `${provider} is out of credits; top up its account`,
    error,
    context,
  });
}

// A Redis outage alerts anyway: the alerter's own hourly cap still bounds the noise.
async function claimCreditsAlert(provider: AIProviderName): Promise<boolean> {
  try {
    const count = await incrementWithTtl(
      `ai-out-of-credits-alert:${provider}`,
      CREDITS_ALERT_WINDOW_SECONDS,
    );
    return count === 1;
  } catch (err) {
    observability.reportError({
      error: err,
      where: 'AI out-of-credits alert claim failed',
      context: { provider },
    });
    return true;
  }
}
