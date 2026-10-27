import { describe, expect, it } from 'vitest';
import type { DetectedSubscription } from '@/types/subscription';
import { buildDetectedSubscription } from '@/test/subscriptionFixtures';
import { sortSubscriptions } from '@/utils/subscriptionSort';

const cheap = buildDetectedSubscription({
  id: 'cheap',
  displayName: 'Zebra',
  monthlyCost: 5,
  annualCost: 60,
});
const mid = buildDetectedSubscription({
  id: 'mid',
  displayName: 'Apple',
  monthlyCost: 20,
  annualCost: 240,
  nextExpectedDate: '2026-08-20T00:00:00.000Z',
});
const yearlyBig = buildDetectedSubscription({
  id: 'yearly',
  displayName: 'Mango',
  frequency: 'YEARLY',
  monthlyCost: 10,
  annualCost: 1200,
  nextExpectedDate: '2027-01-01T00:00:00.000Z',
});

const all = [cheap, mid, yearlyBig];
const ids = (list: DetectedSubscription[]) => list.map((s) => s.id);

describe('sortSubscriptions', () => {
  it('sorts by monthly cost, high to low', () => {
    expect(ids(sortSubscriptions(all, 'MONTHLY_DESC'))).toEqual(['mid', 'yearly', 'cheap']);
  });

  it('sorts by monthly cost, low to high', () => {
    expect(ids(sortSubscriptions(all, 'MONTHLY_ASC'))).toEqual(['cheap', 'yearly', 'mid']);
  });

  it('sorts by annual cost, which can differ from monthly order', () => {
    expect(ids(sortSubscriptions(all, 'ANNUAL_DESC'))).toEqual(['yearly', 'mid', 'cheap']);
  });

  it('sorts by the soonest next charge', () => {
    expect(ids(sortSubscriptions(all, 'NEXT_CHARGE'))).toEqual(['mid', 'cheap', 'yearly']);
  });

  it('sorts by name', () => {
    expect(ids(sortSubscriptions(all, 'NAME'))).toEqual(['mid', 'yearly', 'cheap']);
  });

  it('leaves the input array untouched', () => {
    const input = [...all];
    sortSubscriptions(input, 'MONTHLY_ASC');
    expect(ids(input)).toEqual(['cheap', 'mid', 'yearly']);
  });
});
