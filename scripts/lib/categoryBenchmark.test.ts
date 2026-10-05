import { describe, expect, it } from 'vitest';
import {
  type Decision,
  modelPrices,
  parseBenchmarkArguments,
  percentile,
  priceFor,
  sampleFileSchema,
  scoreDecision,
  summarize,
  toCategories,
} from './categoryBenchmark';

const samples = [
  { description: 'GETT', expected: ['Taxi', 'Transportation'] },
  { description: 'רב קו', expected: ['Transportation'] },
  { description: 'Lime', expected: ['Bikes & Scooters', 'Transportation'] },
];

function decision(overrides: Partial<Decision>): Decision {
  return {
    answer: null,
    categoryId: null,
    durationMs: 100,
    inputTokens: 600,
    outputTokens: 0,
    probability: null,
    error: null,
    ...overrides,
  };
}

describe('parseBenchmarkArguments', () => {
  it('defaults every option', () => {
    expect(parseBenchmarkArguments([])).toEqual({
      samplesPath: 'scripts/data/category-samples.json',
      outPath: null,
      only: null,
      repeat: 1,
    });
  });

  it('reads each flag, keeping an = inside a path', () => {
    expect(
      parseBenchmarkArguments([
        '--samples=a.json',
        '--out=/tmp/a=b.json',
        '--only=llm',
        '--repeat=3',
      ]),
    ).toEqual({
      samplesPath: 'a.json',
      outPath: '/tmp/a=b.json',
      only: 'llm',
      repeat: 3,
    });
  });

  it.each([
    ['--onyl=jev', /Unknown option/],
    ['--only=x', /--only must be jev or llm/],
    ['--repeat=0', /--repeat must be a whole number/],
    ['--repeat=abc', /--repeat must be a whole number/],
    ['--repeat=1.5', /--repeat must be a whole number/],
    ['--out=', /--out needs a value/],
  ])('rejects %s', (argument, message) => {
    expect(() => parseBenchmarkArguments([argument])).toThrow(message);
  });
});

describe('sampleFileSchema', () => {
  it('rejects an expected name no category lists, so a typo cannot lower every score', () => {
    const result = sampleFileSchema.safeParse({
      categories: ['Taxi'],
      samples: [{ description: 'GETT', expected: ['Taxi', 'Taxis'] }],
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      '"Taxis" is not a listed category, so "GETT" could never pass',
    ]);
  });

  it('rejects duplicate category names', () => {
    expect(
      sampleFileSchema.safeParse({
        categories: ['Taxi', 'Taxi'],
        samples: [{ description: 'GETT', expected: ['Taxi'] }],
      }).success,
    ).toBe(false);
  });
});

describe('scoreDecision', () => {
  it('counts the first expected name as exact and the rest as acceptable', () => {
    const taxi = decision({ answer: 'Taxi', categoryId: 'cat-0' });
    const transport = decision({
      answer: 'Transportation',
      categoryId: 'cat-1',
    });
    expect(scoreDecision(samples[0], taxi)).toEqual({
      exact: true,
      acceptable: true,
    });
    expect(scoreDecision(samples[0], transport)).toEqual({
      exact: false,
      acceptable: true,
    });
  });

  it('never credits an answer that resolved to no offered category', () => {
    const unoffered = decision({ answer: 'Taxi', categoryId: null });
    expect(scoreDecision(samples[0], unoffered)).toEqual({
      exact: false,
      acceptable: false,
    });
  });
});

describe('summarize', () => {
  const decisions = [
    decision({ answer: 'Taxi', categoryId: 'cat-0', durationMs: 100 }),
    decision({ answer: 'Car', categoryId: 'cat-9', durationMs: 300 }),
    decision({ error: 'timeout', durationMs: 30_000, inputTokens: null }),
  ];

  it('measures accuracy, latency and cost over answered decisions only', () => {
    const summary = summarize('jev-latest', samples, decisions, {
      input: 0.042,
      output: 0,
    });
    expect(summary).toMatchObject({
      decisions: 3,
      succeeded: 2,
      exactAccuracy: 0.5,
      acceptableAccuracy: 0.5,
      p50Ms: 100,
      p95Ms: 300,
      meanMs: 200,
      inputTokens: 1200,
    });
    expect(summary.runCostUsd).toBeCloseTo((1200 * 0.042) / 1_000_000, 12);
    expect(summary.costPer1000Usd).toBeCloseTo(
      ((1200 * 0.042) / 1_000_000 / 2) * 1000,
      12,
    );
  });

  it('reports no cost for a model without a price', () => {
    expect(
      summarize('mystery', samples, decisions, undefined).runCostUsd,
    ).toBeNull();
  });
});

describe('percentile', () => {
  it('uses the nearest rank', () => {
    const sorted = Array.from({ length: 48 }, (_, index) => index + 1);
    expect(percentile(sorted, 0.5)).toBe(24);
    expect(percentile(sorted, 0.95)).toBe(46);
    expect(percentile([7], 0.95)).toBe(7);
    expect(percentile([], 0.5)).toBe(0);
  });
});

describe('prices', () => {
  it('strips the gateway prefix when looking a model up', () => {
    const prices = modelPrices(new Date('2026-09-20T00:00:00Z'));
    expect(priceFor('openai/gpt-4-turbo', prices)).toEqual(
      priceFor('gpt-4-turbo', prices),
    );
  });

  it('moves Gemini Flash off its introductory price in 2027', () => {
    expect(
      modelPrices(new Date('2026-12-31T00:00:00Z'))['gemini-3.6-flash'].input,
    ).toBe(0.75);
    expect(
      modelPrices(new Date('2027-01-01T00:00:00Z'))['gemini-3.6-flash'].input,
    ).toBe(1.5);
  });
});

describe('toCategories', () => {
  it('gives every name a stable id in order', () => {
    expect(toCategories(['Taxi', 'Car'])).toEqual([
      { id: 'cat-0', name: 'Taxi' },
      { id: 'cat-1', name: 'Car' },
    ]);
  });
});
