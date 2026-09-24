// With only a gateway key set, the OpenAI side goes through the gateway too, so
// one key compares both. Calls run one at a time, as production makes them, so
// latencies are per-decision and not a concurrency artefact.
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import { optionalEnv } from '../src/server/env';
import type { CategorySuggester } from '../src/server/services/ai/aiProvider';
import AIServiceFactory from '../src/server/services/ai/aiServiceFactory';
import { GeminiService } from '../src/server/services/ai/geminiService';
import {
  JevCategorySuggester,
  type JevStrategy,
} from '../src/server/services/ai/jevCategorySuggester';
import { getErrorMessage } from '../src/server/utils/errorUtils';
import type { Category } from '../src/shared/types/category';
import {
  type BenchmarkArguments,
  type Decision,
  GATEWAY_MODEL_PREFIX,
  type Sample,
  type SampleFile,
  type Suggester,
  type Summary,
  modelPrices,
  parseBenchmarkArguments,
  priceFor,
  sampleFileSchema,
  scoreDecision,
  summarize,
  toCategories,
  topLevelNames,
} from './lib/categoryBenchmark';

const GATEWAY_OPENAI_BASE_URL = 'https://ai-gateway.vercel.sh/v1';
// A key that is wrong fails every row the same way; three in a row is enough.
const CONSECUTIVE_ERRORS_TO_ABORT = 3;

interface NamedSuggester {
  label: string;
  suggester: CategorySuggester;
}

interface Run {
  label: string;
  model: string;
  decisions: Decision[];
}

async function main(): Promise<void> {
  const options = parseBenchmarkArguments(process.argv.slice(2));
  const sampleFile = await loadSamples(options.samplesPath);
  const categories = toCategories(sampleFile.categories);
  const samples = Array(options.repeat).fill(sampleFile.samples).flat();
  const topLevelByName = topLevelNames(categories);
  const prices = modelPrices(new Date());

  // Every side is resolved before any runs, so a missing key fails in
  // milliseconds instead of after the first side's paid calls.
  const suggesters: NamedSuggester[] = options.suggesters.map((label) => ({
    label,
    suggester: buildSuggester(label),
  }));

  const runs: Run[] = [];
  for (const { label, suggester } of suggesters) {
    runs.push(await runSuggester(label, suggester, samples, categories));
  }
  const summaries = runs.map((run) =>
    summarize({
      ...run,
      samples,
      price: priceFor(run.model, prices),
      topLevelByName,
    }),
  );

  printDecisions(samples, runs, topLevelByName);
  printErrors(runs);
  printSummaries(summaries);

  if (options.outPath !== null) {
    await writeReport(options, prices, summaries, runs);
  }
  if (summaries.some((summary) => summary.succeeded === 0)) {
    process.exitCode = 1;
  }
}

async function loadSamples(path: string): Promise<SampleFile> {
  const raw = await readFile(resolve(path), 'utf8');
  const parsed = sampleFileSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    throw new Error(
      `${path} is not a valid sample file: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

function buildSuggester(label: Suggester): CategorySuggester {
  switch (label) {
    case 'jev':
      return jevSuggester('flat');
    case 'jev-two-step':
      return jevSuggester('two-step');
    case 'llm':
      return llmSuggester();
  }
}

function jevSuggester(strategy: JevStrategy): CategorySuggester {
  if (!process.env.TYPESAFE_AI_API_KEY && !process.env.AI_GATEWAY_API_KEY) {
    throw new Error(
      'The Jev side needs TYPESAFE_AI_API_KEY or AI_GATEWAY_API_KEY',
    );
  }
  return new JevCategorySuggester(strategy);
}

function llmSuggester(): CategorySuggester {
  const suggester = AIServiceFactory.getAIService();
  if (suggester instanceof GeminiService) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error(
        'AI_PROVIDER=gemini needs GEMINI_API_KEY for the LLM side',
      );
    }
    return suggester;
  }
  routeOpenAiThroughGatewayWithoutOwnKey();
  return suggester;
}

// ChatGPTService reads OPENAI_API_KEY and OPENAI_MODEL at call time and the
// OpenAI SDK reads OPENAI_BASE_URL itself, so setting the three here points
// the production class at the gateway before its lazy client is built.
function routeOpenAiThroughGatewayWithoutOwnKey(): void {
  if (process.env.OPENAI_API_KEY) {
    return;
  }
  const gatewayKey = process.env.AI_GATEWAY_API_KEY;
  if (!gatewayKey) {
    throw new Error(
      'Set OPENAI_API_KEY for the LLM side, or AI_GATEWAY_API_KEY to route it through Vercel AI Gateway',
    );
  }
  const model = optionalEnv('OPENAI_MODEL', 'gpt-4-turbo');
  process.env.OPENAI_API_KEY = gatewayKey;
  process.env.OPENAI_BASE_URL = GATEWAY_OPENAI_BASE_URL;
  process.env.OPENAI_MODEL = model.startsWith(GATEWAY_MODEL_PREFIX)
    ? model
    : `${GATEWAY_MODEL_PREFIX}${model}`;
}

async function runSuggester(
  label: string,
  suggester: CategorySuggester,
  samples: Sample[],
  categories: Category[],
): Promise<Run> {
  const decisions: Decision[] = [];
  let consecutiveErrors = 0;
  for (const sample of samples) {
    const startedAt = Date.now();
    let decision: Decision;
    try {
      const evaluation = await suggester.evaluateCategory(
        sample.description,
        categories,
      );
      decision = {
        answer: evaluation.categoryName,
        categoryId: evaluation.categoryId,
        durationMs: Date.now() - startedAt,
        inputTokens: evaluation.inputTokens,
        outputTokens: evaluation.outputTokens,
        probability: evaluation.probability,
        error: null,
      };
      consecutiveErrors = 0;
    } catch (err) {
      decision = {
        answer: null,
        categoryId: null,
        durationMs: Date.now() - startedAt,
        inputTokens: null,
        outputTokens: null,
        probability: null,
        error: getErrorMessage(err),
      };
      consecutiveErrors += 1;
    }
    decisions.push(decision);
    progress(label, decisions.length, samples.length);
    if (consecutiveErrors >= CONSECUTIVE_ERRORS_TO_ABORT) {
      process.stderr.write(
        `\n${label}: stopping after ${consecutiveErrors} consecutive errors\n`,
      );
      break;
    }
  }
  return { label, model: suggester.modelName(), decisions };
}

function printDecisions(
  samples: Sample[],
  runs: Run[],
  topLevelByName: Map<string, string>,
): void {
  const header = runs.map((run) => run.label).join(' | ');
  console.log(`\n| description | expected | ${header} |`);
  console.log(`| --- | --- |${runs.map(() => ' --- |').join('')}`);
  samples.forEach((sample, index) => {
    const cells = runs.map((run) =>
      mark(sample, run.decisions[index], topLevelByName),
    );
    console.log(
      `| ${sample.description} | ${sample.expected[0]} | ${cells.join(' | ')} |`,
    );
  });
}

function mark(
  sample: Sample,
  decision: Decision | undefined,
  topLevelByName: Map<string, string>,
): string {
  if (!decision) {
    return 'not run';
  }
  if (decision.error !== null) {
    return 'ERROR';
  }
  const score = scoreDecision(sample, decision, topLevelByName);
  const verdict = score.exact
    ? '✓'
    : score.acceptable
      ? '~'
      : score.rightBranch
        ? '≈'
        : '✗';
  const answer =
    decision.categoryId === null
      ? `${decision.answer ?? '(none)'}?`
      : decision.answer;
  const probability =
    decision.probability === null
      ? ''
      : ` p=${decision.probability.toFixed(2)}`;
  return `${verdict} ${answer}${probability}`;
}

function printErrors(runs: Run[]): void {
  runs.forEach((run) => {
    const messages = new Set(
      run.decisions.flatMap((decision) =>
        decision.error === null ? [] : [decision.error],
      ),
    );
    if (messages.size > 0) {
      console.log(`\nErrors from ${run.label}:`);
      messages.forEach((message) => console.log(`- ${message}`));
    }
  });
}

const SUMMARY_ROWS: [string, (summary: Summary) => string][] = [
  ['decisions', (summary) => String(summary.decisions)],
  ['answered', (summary) => String(summary.succeeded)],
  ['exact accuracy', (summary) => percent(summary.exactAccuracy)],
  ['acceptable accuracy', (summary) => percent(summary.acceptableAccuracy)],
  ['right-branch accuracy', (summary) => percent(summary.rightBranchAccuracy)],
  ['latency p50 ms', (summary) => String(summary.p50Ms)],
  ['latency p95 ms', (summary) => String(summary.p95Ms)],
  ['latency mean ms', (summary) => String(summary.meanMs)],
  ['input tokens', (summary) => String(summary.inputTokens)],
  ['output tokens', (summary) => String(summary.outputTokens)],
  ['cost this run (USD)', (summary) => money(summary.runCostUsd)],
  [
    'cost per 1,000 decisions (USD)',
    (summary) => money(summary.costPer1000Usd),
  ],
];

function printSummaries(summaries: Summary[]): void {
  console.log(
    `\n| metric | ${summaries.map((summary) => `${summary.label} (${summary.model})`).join(' | ')} |`,
  );
  console.log(`| --- |${summaries.map(() => ' --- |').join('')}`);
  SUMMARY_ROWS.forEach(([label, cell]) => {
    console.log(`| ${label} | ${summaries.map(cell).join(' | ')} |`);
  });
}

async function writeReport(
  options: BenchmarkArguments,
  prices: ReturnType<typeof modelPrices>,
  summaries: Summary[],
  runs: Run[],
): Promise<void> {
  const report = {
    generatedAt: new Date().toISOString(),
    options,
    prices,
    summaries,
    runs,
  };
  await writeFile(options.outPath!, JSON.stringify(report, null, 2));
  console.log(`\nWrote ${options.outPath}`);
}

function progress(label: string, done: number, total: number): void {
  process.stderr.write(`\r${label}: ${done}/${total}`);
  if (done === total) {
    process.stderr.write('\n');
  }
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function money(value: number | null): string {
  return value === null ? 'unknown price' : `$${value.toFixed(4)}`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
