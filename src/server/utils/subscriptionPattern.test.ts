import { describe, expect, it } from 'vitest';
import {
  analyzeMerchantPattern,
  MerchantCharge,
  MerchantGroup,
} from '@/server/utils/subscriptionPattern';

const ANALYZED_FROM = new Date('2025-08-18T00:00:00Z');
const ANALYZED_TO = new Date('2026-08-18T00:00:00Z');

const charge = (
  date: string,
  value = 49.9,
  description = 'NETFLIX.COM',
  categoryId?: string,
): MerchantCharge => ({
  date: new Date(`${date}T00:00:00Z`),
  value,
  description,
  categoryId,
});

const group = (charges: MerchantCharge[]): MerchantGroup => ({
  merchantKey: 'netflix',
  charges,
});

const monthly = group([
  charge('2026-05-04'),
  charge('2026-06-04'),
  charge('2026-07-04'),
  charge('2026-08-04'),
]);

const analyze = (g: MerchantGroup) =>
  analyzeMerchantPattern(g, ANALYZED_FROM, ANALYZED_TO);

describe('analyzeMerchantPattern', () => {
  it('classifies an evenly spaced monthly charge', () => {
    const pattern = analyze(monthly);
    expect(pattern?.frequency).toBe('MONTHLY');
    expect(pattern?.averageAmount).toBe(49.9);
    expect(pattern?.annualCost).toBe(598.8);
    expect(pattern?.lastChargeDate).toEqual(new Date('2026-08-04T00:00:00Z'));
    expect(pattern?.nextExpectedDate).toEqual(new Date('2026-09-04T00:00:00Z'));
  });

  it('needs at least three charges', () => {
    expect(analyze(group([charge('2026-07-04'), charge('2026-08-04')]))).toBe(
      null,
    );
  });

  it('rejects spacing that varies more than the tolerance', () => {
    const erratic = group([
      charge('2026-01-01'),
      charge('2026-02-01'),
      charge('2026-05-20'),
      charge('2026-06-02'),
    ]);
    expect(analyze(erratic)).toBe(null);
  });

  it('rejects gaps that match no frequency window', () => {
    const biMonthly = group([
      charge('2026-02-01'),
      charge('2026-04-01'),
      charge('2026-06-01'),
      charge('2026-08-01'),
    ]);
    expect(analyze(biMonthly)).toBe(null);
  });

  it('classifies weekly and yearly windows', () => {
    const weekly = analyze(
      group([
        charge('2026-07-07'),
        charge('2026-07-14'),
        charge('2026-07-21'),
        charge('2026-07-28'),
      ]),
    );
    expect(weekly?.frequency).toBe('WEEKLY');

    const yearly = analyze(
      group([charge('2024-03-01'), charge('2025-03-01'), charge('2026-03-01')]),
    );
    expect(yearly?.frequency).toBe('YEARLY');
  });

  it('records the evidence behind the decision', () => {
    const pattern = analyze(monthly);
    const evidence = pattern!.evidence;

    expect(evidence.chargeCount).toBe(4);
    expect(evidence.merchantKey).toBe('netflix');
    expect(evidence.medianIntervalDays).toBe(31);
    expect(evidence.frequencyWindowDays).toEqual({ min: 25, max: 35 });
    expect(evidence.intervalVariationRatio).toBeLessThanOrEqual(
      evidence.intervalToleranceRatio,
    );
    expect(evidence.minAmount).toBe(49.9);
    expect(evidence.maxAmount).toBe(49.9);
    expect(evidence.firstChargeDate).toBe('2026-05-04T00:00:00.000Z');
    expect(evidence.lastChargeDate).toBe('2026-08-04T00:00:00.000Z');
    expect(evidence.analyzedFrom).toBe(ANALYZED_FROM.toISOString());
    expect(evidence.olderChargeCount).toBe(0);
  });

  it('lists the matched charges newest first, capped at twelve', () => {
    const many = group(
      Array.from({ length: 14 }, (_, index) => ({
        date: new Date(Date.UTC(2025, index, 3)),
        value: 10,
        description: 'NETFLIX.COM',
      })),
    );
    const evidence = analyze(many)!.evidence;

    expect(evidence.recentCharges).toHaveLength(12);
    expect(evidence.olderChargeCount).toBe(2);
    const dates = evidence.recentCharges.map((c) => new Date(c.date).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
  });

  it('reports amount spread when charges differ', () => {
    const evidence = analyze(
      group([
        charge('2026-05-04', 40),
        charge('2026-06-04', 50),
        charge('2026-07-04', 60),
        charge('2026-08-04', 50),
      ]),
    )!.evidence;

    expect(evidence.minAmount).toBe(40);
    expect(evidence.maxAmount).toBe(60);
    expect(evidence.averageAmount).toBe(50);
  });

  it('adopts the category most of the charges already use', () => {
    const pattern = analyze(
      group([
        charge('2026-05-04', 49.9, 'NETFLIX.COM', 'cat-entertainment'),
        charge('2026-06-04', 49.9, 'NETFLIX.COM', 'cat-entertainment'),
        charge('2026-07-04', 49.9, 'NETFLIX.COM', 'cat-misc'),
        charge('2026-08-04', 49.9, 'NETFLIX.COM', 'cat-entertainment'),
      ]),
    );
    expect(pattern?.categoryId).toBe('cat-entertainment');
  });

  it('leaves the category unset when no charge has one', () => {
    expect(analyze(monthly)?.categoryId).toBeUndefined();
  });

  it('names the subscription after the most common description', () => {
    const pattern = analyze(
      group([
        charge('2026-05-04', 49.9, 'NETFLIX.COM'),
        charge('2026-06-04', 49.9, 'netflix.com'),
        charge('2026-07-04', 49.9, 'netflix.com'),
        charge('2026-08-04', 49.9, 'netflix.com'),
      ]),
    );
    expect(pattern?.displayName).toBe('Netflix.com');
    expect(pattern?.descriptions).toEqual(['NETFLIX.COM', 'netflix.com']);
  });
});
