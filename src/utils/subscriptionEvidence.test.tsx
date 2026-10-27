// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Locale } from '@yaniv120892/my-ui';
import { useAppFormat } from '@/i18n/useAppFormat';
import { useT } from '@/i18n/useT';
import { DesignTestProvider } from '@/test/renderWithClient';
import type { SubscriptionDetectionEvidence } from '@/shared/types/subscription';
import { buildDetectedSubscription, buildDetectionEvidence } from '@/test/subscriptionFixtures';
import { buildEvidenceReasons, withChargeGaps } from '@/utils/subscriptionEvidence';

const evidence = buildDetectionEvidence;

const subscription = buildDetectedSubscription({
  merchantName: 'netflix',
  frequency: 'MONTHLY',
  confidence: 0.98,
});

function reasonsFor({
  over = {},
  locale = 'en',
}: {
  over?: Partial<SubscriptionDetectionEvidence>;
  locale?: Locale;
} = {}): string[] {
  const { result } = renderHook(() => ({ t: useT(), formatter: useAppFormat() }), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <DesignTestProvider locale={locale}>{children}</DesignTestProvider>
    ),
  });
  return buildEvidenceReasons({
    subscription,
    evidence: evidence(over),
    ...result.current,
  });
}

describe('buildEvidenceReasons', () => {
  it('states the charge count, merchant and date span', () => {
    const [first] = reasonsFor();
    expect(first).toContain('4 charges');
    expect(first).toContain('netflix');
    expect(first).toContain('May 4, 2026');
    expect(first).toContain('Aug 4, 2026');
  });

  it('names the frequency window the typical gap fell into', () => {
    const reasons = reasonsFor();
    expect(reasons[1]).toContain('every 31 days');
    expect(reasons[1]).toContain('monthly window of 25–35 days');
  });

  it('compares the spacing variation against the tolerance', () => {
    const reasons = reasonsFor();
    expect(reasons[2]).toContain('varies by 0.5 days');
    expect(reasons[2]).toContain('2% of the typical gap');
    expect(reasons[2]).toContain('above 30%');
  });

  it('says the amount was identical when it never moved', () => {
    const reasons = reasonsFor();
    expect(reasons[3]).toContain('Every charge was');
  });

  it('reports the range when amounts differ', () => {
    const reasons = reasonsFor({
      over: { minAmount: 40, maxAmount: 60, averageAmount: 50 },
    });
    expect(reasons[3]).toContain('ranged from');
    expect(reasons[3]).toContain('averaging');
  });

  it('closes with the confidence percentage', () => {
    const reasons = reasonsFor();
    expect(reasons[reasons.length - 1]).toContain('98%');
  });

  it('speaks Hebrew with Hebrew dates when the locale is Hebrew', () => {
    const reasons = reasonsFor({ locale: 'he' });
    expect(reasons[0]).toContain('4 חיובים');
    expect(reasons[0]).toContain('netflix');
    expect(reasons[0]).toContain('במאי 2026');
    expect(reasons[1]).toContain('חודשי');
  });
});

const charge = (date: string) => ({ date, amount: 10, description: 'NETFLIX' });

describe('withChargeGaps', () => {
  it('measures each newest-first charge against the one before it', () => {
    expect(
      withChargeGaps([
        charge('2026-08-04T00:00:00.000Z'),
        charge('2026-07-04T00:00:00.000Z'),
        charge('2026-06-04T00:00:00.000Z'),
      ]).map((c) => c.gapDays),
    ).toEqual([31, 30, null]);
  });

  it('keeps the charge fields alongside the gap', () => {
    expect(withChargeGaps([charge('2026-08-04T00:00:00.000Z')])).toEqual([
      {
        date: '2026-08-04T00:00:00.000Z',
        amount: 10,
        description: 'NETFLIX',
        gapDays: null,
      },
    ]);
  });

  it('handles an empty list', () => {
    expect(withChargeGaps([])).toEqual([]);
  });
});
