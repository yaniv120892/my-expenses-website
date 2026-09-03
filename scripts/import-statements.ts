/**
 * The upload dialog caps a batch at ten files and applies one payment month to
 * all of them, which a multi-month backfill across several cards cannot use.
 *
 *   IMPORT_API_TOKEN=<bearer> npx tsx scripts/import-statements.ts <dir> [--dry-run]
 */
import { readdir, readFile } from 'fs/promises';
import { basename, extname, join } from 'path';
import { createInterface } from 'readline/promises';
import { toDayString } from '../src/shared/dates';
import type { ReconciliationPlanItem } from '../src/shared/types/import';
import type { BatchActionRequest, BatchResult } from '../src/types/import';
import { Import, ImportStatus } from '../src/types/import';
import { ACTIVE_IMPORT_STATUSES } from '../src/utils/importStatus';

class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

const IMPORTABLE_EXTENSIONS = ['.csv', '.xls', '.xlsx'];
const STATEMENT_NAME_PATTERN = /^(.+)-(\d{4})-(\d{2})-(\d{4})$/;
const FIRST_POLL_INTERVAL_MS = 2000;
const MAX_POLL_INTERVAL_MS = 10000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

type ImportRecord = Pick<
  Import,
  | 'id'
  | 'status'
  | 'originalFileName'
  | 'error'
  | 'creditCardLastFourDigits'
  | 'paymentMonth'
>;

type ParsedStatementName = {
  cardLastFour: string;
  paymentMonth: string;
};

type Statement = {
  filePath: string;
  fileName: string;
  // Null when the file does not follow the naming convention; the extraction
  // service still reports a payment month of its own.
  parsedName: ParsedStatementName | null;
};

type SubmittedStatement = {
  statement: Statement;
  importId: string;
};

type ResolvedTarget = {
  importRecord: ImportRecord;
  // Reached by following a merge, so its rows may still be being matched.
  followedMerge: boolean;
};

type PlannedImport = {
  importRecord: ImportRecord;
  plan: ReconciliationPlanItem[];
};

async function main(): Promise<void> {
  const { directory, dryRun, baseUrl } = parseArguments();
  const token = process.env.IMPORT_API_TOKEN;
  if (!token) {
    throw new Error(
      'IMPORT_API_TOKEN is not set; dev:local prints one as "Bearer" on startup',
    );
  }

  const client = createApiClient(baseUrl, token);
  const statements = await collectStatements(directory);
  if (statements.length === 0) {
    throw new Error(
      `No ${IMPORTABLE_EXTENSIONS.join('/')} files found in ${directory}`,
    );
  }

  reportStatements(statements);

  const submitted: SubmittedStatement[] = [];
  for (const statement of statements) {
    const importId = await submitStatement(client, statement);
    submitted.push({ statement, importId });
    console.log(`  submitted ${statement.fileName} -> ${importId}`);
  }

  console.log('\nWaiting for extraction to finish...');
  const imports = await waitForImports(
    client,
    submitted.map((entry) => entry.importId),
  );
  const targets = resolveTargets(submitted, imports);
  reportFailedImports(targets);
  await settleMergedTargets(client, targets);

  const planned = await loadPlans(client, targets);
  renderPlanTable(planned);

  const totals = countActions(planned);
  if (totals.merge + totals.create === 0) {
    console.log('\nNothing pending to reconcile.');
    return;
  }

  if (dryRun) {
    console.log('\n--dry-run: nothing was written.');
    return;
  }

  const approved = await confirm(
    `\nApply ${totals.merge} merge(s) and ${totals.create} create(s)? [y/N] `,
  );
  if (!approved) {
    console.log('Aborted; nothing was written.');
    return;
  }

  await commitPlans(client, planned);
}

function parseArguments(): {
  directory: string;
  dryRun: boolean;
  baseUrl: string;
} {
  const args = process.argv.slice(2);
  const directory = args.find((arg) => !arg.startsWith('--'));
  if (!directory) {
    throw new Error(
      'Usage: tsx scripts/import-statements.ts <dir> [--dry-run] [--base-url=<url>]',
    );
  }

  const baseUrlArg = args.find((arg) => arg.startsWith('--base-url='));

  return {
    directory,
    dryRun: args.includes('--dry-run'),
    baseUrl: baseUrlArg
      ? baseUrlArg.slice('--base-url='.length)
      : 'http://127.0.0.1:3000',
  };
}

/**
 * `<issuer>-<last4>-<MM>-<YYYY>.xlsx` carries the payment month the dialog
 * would otherwise ask for per batch, and identifies the import to follow when a
 * duplicate is merged away.
 */
async function collectStatements(directory: string): Promise<Statement[]> {
  const entries = await readdir(directory);

  return entries
    .filter((entry) =>
      IMPORTABLE_EXTENSIONS.includes(extname(entry).toLowerCase()),
    )
    .sort()
    .map((entry) => ({
      filePath: join(directory, entry),
      fileName: entry,
      parsedName: parseStatementName(entry),
    }));
}

function parseStatementName(fileName: string): ParsedStatementName | null {
  const match = STATEMENT_NAME_PATTERN.exec(
    basename(fileName, extname(fileName)),
  );
  if (!match) {
    return null;
  }

  const [, , cardLastFour, month, year] = match;
  return { cardLastFour, paymentMonth: `${month}/${year}` };
}

function reportStatements(statements: Statement[]): void {
  console.log(`Found ${statements.length} statement file(s):`);
  for (const statement of statements) {
    const month = statement.parsedName?.paymentMonth ?? 'month from extraction';
    console.log(`  ${statement.fileName}  (${month})`);
  }
  console.log('');
}

function createApiClient(baseUrl: string, token: string) {
  const request = async <T>(
    method: string,
    path: string,
    body?: BodyInit,
    headers: Record<string, string> = {},
  ): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...headers },
      body,
    });

    const text = await response.text();
    if (!response.ok) {
      throw new ApiError(
        `${method} ${path} failed (${response.status}): ${text}`,
        response.status,
      );
    }
    if (!text) {
      throw new Error(`${method} ${path} returned an empty body`);
    }

    return JSON.parse(text);
  };

  return {
    getJson: <T>(path: string) => request<T>('GET', path),
    postJson: <T>(path: string, payload: unknown) =>
      request<T>('POST', path, JSON.stringify(payload), {
        'Content-Type': 'application/json',
      }),
    postForm: <T>(path: string, form: FormData) =>
      request<T>('POST', path, form),
  };
}

type ApiClient = ReturnType<typeof createApiClient>;

async function submitStatement(
  client: ApiClient,
  statement: Statement,
): Promise<string> {
  const form = new FormData();
  const contents = await readFile(statement.filePath);
  form.append('file', new Blob([contents]), statement.fileName);

  const { fileUrl } = await client.postForm<{ fileUrl: string }>(
    '/api/imports/upload',
    form,
  );

  const created = await client.postJson<{ id: string }>(
    '/api/imports/process',
    {
      fileUrl,
      originalFileName: statement.fileName,
      ...(statement.parsedName
        ? { paymentMonth: statement.parsedName.paymentMonth }
        : {}),
    },
  );

  return created.id;
}

/**
 * The interval backs off because `/api/imports` counts every import's rows and
 * a full backfill's extraction runs for minutes.
 */
async function waitForImports(
  client: ApiClient,
  submittedIds: string[],
): Promise<ImportRecord[]> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let interval = FIRST_POLL_INTERVAL_MS;

  while (Date.now() < deadline) {
    const imports = await client.getJson<ImportRecord[]>('/api/imports');
    const byId = new Map(imports.map((record) => [record.id, record]));
    const stillRunning = submittedIds.filter((id) => {
      const record = byId.get(id);
      return (
        record !== undefined && ACTIVE_IMPORT_STATUSES.includes(record.status)
      );
    });

    if (stillRunning.length === 0) {
      const mergedAway = submittedIds.filter((id) => !byId.has(id)).length;
      if (mergedAway > 0) {
        console.log(
          `  ${mergedAway} import(s) merged into an existing import for the same card and month`,
        );
      }
      return imports;
    }

    await sleep(interval);
    interval = Math.min(interval * 2, MAX_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Extraction did not finish within ${POLL_TIMEOUT_MS / 1000}s; check the imports page`,
  );
}

/**
 * A statement whose import merged into an older one for the same card and month
 * has its rows waiting under that survivor, so reconciliation has to follow it
 * there. Without this a re-import silently reconciles nothing.
 */
function resolveTargets(
  submitted: SubmittedStatement[],
  imports: ImportRecord[],
): ResolvedTarget[] {
  const byId = new Map(imports.map((record) => [record.id, record]));
  const resolved = new Map<string, ResolvedTarget>();

  for (const { statement, importId } of submitted) {
    const direct = byId.get(importId);
    const target = direct ?? findMergeSurvivor(statement, imports);
    if (!target) {
      console.log(
        `  could not locate the import for ${statement.fileName}; reconcile it from the imports page`,
      );
      continue;
    }
    const followedMerge = direct === undefined;
    const existing = resolved.get(target.id);
    resolved.set(target.id, {
      importRecord: target,
      followedMerge: followedMerge || (existing?.followedMerge ?? false),
    });
  }

  return [...resolved.values()];
}

/**
 * The webhook deletes a duplicate import before it finishes matching the rows
 * it moved into the survivor, so the id disappearing is not proof that matching
 * has run. Re-matching the survivor makes it deterministic before anything is
 * previewed — otherwise the plan can show CREATE for rows that become MERGE a
 * second later, and approving it writes duplicates.
 */
async function settleMergedTargets(
  client: ApiClient,
  targets: ResolvedTarget[],
): Promise<void> {
  for (const target of targets) {
    if (!target.followedMerge) {
      continue;
    }

    try {
      await client.postJson<{ success: boolean }>(
        `/api/imports/${target.importRecord.id}/rematch`,
        {},
      );
    } catch (error) {
      // A survivor with nothing left pending answers 409, which is the ordinary
      // outcome of re-importing a statement that is already reconciled.
      if (error instanceof ApiError && error.status === 409) {
        continue;
      }
      throw error;
    }
  }
}

function findMergeSurvivor(
  statement: Statement,
  imports: ImportRecord[],
): ImportRecord | undefined {
  const parsed = statement.parsedName;
  if (!parsed) {
    return undefined;
  }

  return imports.find(
    (record) =>
      record.creditCardLastFourDigits === parsed.cardLastFour &&
      record.paymentMonth === parsed.paymentMonth,
  );
}

function reportFailedImports(targets: ResolvedTarget[]): void {
  for (const { importRecord } of targets) {
    if (importRecord.status === ImportStatus.FAILED) {
      console.log(
        `  FAILED ${importRecord.originalFileName}: ${importRecord.error ?? ''}`,
      );
    }
  }
}

async function loadPlans(
  client: ApiClient,
  targets: ResolvedTarget[],
): Promise<PlannedImport[]> {
  const completed = targets
    .map((target) => target.importRecord)
    .filter((record) => record.status === ImportStatus.COMPLETED);

  return Promise.all(
    completed.map(async (importRecord) => ({
      importRecord,
      plan: await client.getJson<ReconciliationPlanItem[]>(
        `/api/imports/${importRecord.id}/reconciliation-preview`,
      ),
    })),
  );
}

function renderPlanTable(planned: PlannedImport[]): void {
  for (const { importRecord, plan } of planned) {
    const card = importRecord.creditCardLastFourDigits ?? '????';
    const month = importRecord.paymentMonth ?? '??/????';
    console.log(
      `\n=== ${importRecord.originalFileName} — card ${card}, ${month} ===`,
    );

    if (plan.length === 0) {
      console.log('  (nothing pending)');
      continue;
    }

    for (const item of plan) {
      console.log(`  ${describePlanItem(item)}`);
    }
  }
}

function describePlanItem(item: ReconciliationPlanItem): string {
  const date = formatDate(item.date);
  const summary = `${date}  ${item.value.toFixed(2).padStart(9)}  ${item.description}`;

  if (item.action === 'CREATE' || !item.match) {
    return `CREATE  ${summary}`;
  }

  const approves = item.match.approvesPendingTransaction
    ? ' (approves pending)'
    : '';
  const before = item.match.before;
  const beforeDate = formatDate(before.date);
  const changes = [
    before.description === item.description
      ? null
      : `description "${before.description}" -> "${item.description}"`,
    before.value === item.value
      ? null
      : `value ${before.value.toFixed(2)} -> ${item.value.toFixed(2)}`,
    beforeDate === date ? null : `date ${beforeDate} -> ${date}`,
  ].filter((change) => change !== null);

  const diff = changes.length > 0 ? `\n            ${changes.join('; ')}` : '';
  return `MERGE   ${summary}${approves}${diff}`;
}

/** Dates arrive as JSON strings even though the plan type names them Date. */
function formatDate(value: Date | string): string {
  return toDayString(new Date(value));
}

function countActions(planned: PlannedImport[]): {
  merge: number;
  create: number;
} {
  const items = planned.flatMap(({ plan }) => plan);
  const merge = items.filter((item) => item.action === 'MERGE').length;

  return { merge, create: items.length - merge };
}

async function commitPlans(
  client: ApiClient,
  planned: PlannedImport[],
): Promise<void> {
  for (const { importRecord, plan } of planned) {
    if (plan.length === 0) {
      continue;
    }

    // Naming the rows pins the commit to what was previewed, so a row that
    // appeared since — a rematch, another session — is not approved unseen.
    const body: BatchActionRequest = {
      importId: importRecord.id,
      transactionIds: plan.map((item) => item.importedTransactionId),
      action: 'approve',
    };
    const { succeeded, failed, errors } = await client.postJson<BatchResult>(
      '/api/imports/batch-action',
      body,
    );

    console.log(
      `${importRecord.originalFileName}: ${succeeded} applied, ${failed} failed`,
    );
    for (const failure of errors) {
      console.log(`  ${failure.id}: ${failure.error}`);
    }
  }
}

async function confirm(question: string): Promise<boolean> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await readline.question(question);
    return answer.trim().toLowerCase() === 'y';
  } finally {
    readline.close();
  }
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
