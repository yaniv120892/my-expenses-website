// Kept apart from scripts/compare-category-suggesters.ts so it can be unit
// tested: the script runs on import.
import { z } from 'zod';
import type { Category } from '../../src/shared/types/category';

export const USAGE =
  'Usage: tsx scripts/compare-category-suggesters.ts [--samples=<json>] [--out=<json>] [--suggesters=jev,jev-two-step,llm] [--repeat=<n>]';
export const DEFAULT_SAMPLES_PATH = 'scripts/data/category-samples.json';
export const GATEWAY_MODEL_PREFIX = 'openai/';

export const SUGGESTERS = ['jev', 'jev-two-step', 'llm'] as const;
export type Suggester = (typeof SUGGESTERS)[number];

export interface BenchmarkArguments {
  samplesPath: string;
  outPath: string | null;
  suggesters: Suggester[];
  repeat: number;
}

const suggesterSchema = z.enum(SUGGESTERS);

export function parseBenchmarkArguments(argv: string[]): BenchmarkArguments {
  const parsed: BenchmarkArguments = {
    samplesPath: DEFAULT_SAMPLES_PATH,
    outPath: null,
    suggesters: [...SUGGESTERS],
    repeat: 1,
  };
  for (const argument of argv) {
    const separator = argument.indexOf('=');
    const flag = separator === -1 ? argument : argument.slice(0, separator);
    const value = separator === -1 ? '' : argument.slice(separator + 1);
    switch (flag) {
      case '--samples':
        parsed.samplesPath = requireValue(flag, value);
        break;
      case '--out':
        parsed.outPath = requireValue(flag, value);
        break;
      case '--suggesters':
        parsed.suggesters = parseSuggesters(value);
        break;
      case '--repeat':
        parsed.repeat = parseRepeat(value);
        break;
      default:
        throw new Error(`Unknown option ${argument}\n${USAGE}`);
    }
  }
  return parsed;
}

const sampleSchema = z.object({
  description: z.string().min(1),
  /** The first name is the label; any other listed name is acceptable. */
  expected: z.array(z.string().min(1)).min(1),
});

/** A bare name is a category with no children. */
const categoryEntrySchema = z.union([
  z.string().min(1),
  z.object({
    name: z.string().min(1),
    children: z.array(z.string().min(1)).min(1),
  }),
]);

export const sampleFileSchema = z
  .object({
    categories: z.array(categoryEntrySchema).min(1),
    samples: z.array(sampleSchema).min(1),
  })
  .superRefine((file, context) => {
    const allNames = toCategories(file.categories).map(({ name }) => name);
    const names = new Set(allNames);
    if (names.size !== allNames.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['categories'],
        message: 'category names must be unique',
      });
    }
    file.samples.forEach((sample, index) => {
      sample.expected
        .filter((name) => !names.has(name))
        .forEach((name) => {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['samples', index, 'expected'],
            message: `"${name}" is not a listed category, so "${sample.description}" could never pass`,
          });
        });
    });
  });

export type SampleFile = z.infer<typeof sampleFileSchema>;
export type Sample = z.infer<typeof sampleSchema>;
type CategoryEntry = z.infer<typeof categoryEntrySchema>;

/** Flattens the tree parent-first, numbering ids in that order. */
export function toCategories(entries: CategoryEntry[]): Category[] {
  const categories: Category[] = [];
  const add = (name: string, parentId: string | null): string => {
    const id = `cat-${categories.length}`;
    categories.push({ id, name, parentId });
    return id;
  };
  for (const entry of entries) {
    if (typeof entry === 'string') {
      add(entry, null);
      continue;
    }
    const parentId = add(entry.name, null);
    entry.children.forEach((child) => add(child, parentId));
  }
  return categories;
}

/** Each category name to its top-level ancestor's name. */
export function topLevelNames(categories: Category[]): Map<string, string> {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const topLevelOf = (category: Category): string => {
    const parent = category.parentId ? byId.get(category.parentId) : undefined;
    return parent ? topLevelOf(parent) : category.name;
  };
  return new Map(
    categories.map((category) => [category.name, topLevelOf(category)]),
  );
}

export interface Decision {
  /** The model's normalized answer, kept even when it names no offered category. */
  answer: string | null;
  categoryId: string | null;
  durationMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  probability: number | null;
  error: string | null;
}

export interface Score {
  exact: boolean;
  acceptable: boolean;
  /** The answer sits under the same top-level category as the label. */
  rightBranch: boolean;
}

export function scoreDecision(
  sample: Sample,
  decision: Decision,
  topLevelByName: Map<string, string>,
): Score {
  const chosen = decision.categoryId === null ? null : decision.answer;
  return {
    exact: chosen === sample.expected[0],
    acceptable: chosen !== null && sample.expected.includes(chosen),
    rightBranch:
      chosen !== null &&
      topLevelByName.get(chosen) === topLevelByName.get(sample.expected[0]),
  };
}

export interface Price {
  input: number;
  output: number;
}

/** USD per million tokens, list prices; edit when they move. */
export function modelPrices(now: Date): Record<string, Price> {
  const geminiIntroductoryPricingEnds = Date.UTC(2027, 0, 1);
  return {
    'typesafe-ai/jev': { input: 0.042, output: 0 },
    'jev-latest': { input: 0.042, output: 0 },
    'gpt-4-turbo': { input: 10, output: 30 },
    'gemini-3.6-flash':
      now.getTime() < geminiIntroductoryPricingEnds
        ? { input: 0.75, output: 3.75 }
        : { input: 1.5, output: 7.5 },
  };
}

export function priceFor(
  model: string,
  prices: Record<string, Price>,
): Price | undefined {
  const bareModel = model.startsWith(GATEWAY_MODEL_PREFIX)
    ? model.slice(GATEWAY_MODEL_PREFIX.length)
    : model;
  return prices[bareModel];
}

export interface Summary {
  label: string;
  model: string;
  decisions: number;
  /** Decisions that got an answer; accuracy, latency and cost are over these. */
  succeeded: number;
  exactAccuracy: number;
  acceptableAccuracy: number;
  rightBranchAccuracy: number;
  p50Ms: number;
  p95Ms: number;
  meanMs: number;
  inputTokens: number;
  outputTokens: number;
  runCostUsd: number | null;
  costPer1000Usd: number | null;
}

export interface RunToSummarize {
  label: string;
  model: string;
  samples: Sample[];
  decisions: Decision[];
  price: Price | undefined;
  topLevelByName: Map<string, string>;
}

export function summarize({
  label,
  model,
  samples,
  decisions,
  price,
  topLevelByName,
}: RunToSummarize): Summary {
  const succeeded = decisions
    .map((decision, index) => ({ decision, sample: samples[index] }))
    .filter(({ decision }) => decision.error === null);
  const scores = succeeded.map(({ decision, sample }) =>
    scoreDecision(sample, decision, topLevelByName),
  );
  const latencies = succeeded
    .map(({ decision }) => decision.durationMs)
    .sort((a, b) => a - b);
  const inputTokens = sum(
    succeeded.map(({ decision }) => decision.inputTokens ?? 0),
  );
  const outputTokens = sum(
    succeeded.map(({ decision }) => decision.outputTokens ?? 0),
  );
  const runCostUsd = price
    ? (inputTokens * price.input + outputTokens * price.output) / 1_000_000
    : null;
  const count = succeeded.length;
  const share = (hit: (score: Score) => boolean): number =>
    count === 0 ? 0 : scores.filter(hit).length / count;
  return {
    label,
    model,
    decisions: decisions.length,
    succeeded: count,
    exactAccuracy: share((score) => score.exact),
    acceptableAccuracy: share((score) => score.acceptable),
    rightBranchAccuracy: share((score) => score.rightBranch),
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    meanMs: count === 0 ? 0 : Math.round(sum(latencies) / count),
    inputTokens,
    outputTokens,
    runCostUsd,
    costPer1000Usd:
      runCostUsd === null || count === 0 ? null : (runCostUsd / count) * 1000,
  };
}

/** Nearest-rank percentile over an ascending list. */
export function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const rank = Math.ceil(sorted.length * fraction) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(rank, 0))];
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function parseSuggesters(value: string): Suggester[] {
  const parsed = z
    .array(suggesterSchema)
    .min(1)
    .safeParse(value.split(',').filter(Boolean));
  if (!parsed.success) {
    throw new Error(
      `--suggesters must list ${SUGGESTERS.join(', ')} (got "${value}")\n${USAGE}`,
    );
  }
  return [...new Set(parsed.data)];
}

function parseRepeat(value: string): number {
  const repeat = Number(value);
  if (!Number.isInteger(repeat) || repeat < 1) {
    throw new Error(
      `--repeat must be a whole number of 1 or more (got "${value}")\n${USAGE}`,
    );
  }
  return repeat;
}

function requireValue(flag: string, value: string): string {
  if (value === '') {
    throw new Error(`${flag} needs a value\n${USAGE}`);
  }
  return value;
}
