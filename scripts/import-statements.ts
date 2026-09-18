/**
 * The upload dialog caps a batch at ten files and applies one payment month to
 * all of them, which a multi-month backfill across several cards cannot use.
 *
 *   IMPORT_API_TOKEN=<bearer> npx tsx scripts/import-statements.ts <dir> [--dry-run] [--resubmit] [--base-url=<url>]
 *
 * Each file is uploaded once per target: the import it became is recorded in
 * `.import-statements.json` beside the statements, and later runs — the commit
 * after a dry run, a re-run to check nothing is left — act on that import
 * rather than uploading again. Uploading twice would hand the extractor the
 * same statement twice, and it does not spell every merchant the same way on
 * the second pass. `--resubmit` uploads everything regardless; an upload that
 * duplicates an older import is followed to it through the pointer the server
 * records on the duplicate.
 *
 * The token may come from IMPORT_API_TOKEN_FILE instead. A non-local
 * --base-url has to be confirmed by typing its hostname before anything is
 * approved. The recipe, including the production invocation, is in
 * .claude/skills/collect-statements/SKILL.md.
 */
import { readdir, readFile, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { createInterface } from 'readline/promises';
import {
  type ImportManifest,
  MANIFEST_FILE_NAME,
  emptyManifest,
  parseManifest,
  planDrift,
  recordedImport,
  recordedPreview,
  serializeManifest,
  withPreview,
  withResolvedImport,
  withSubmission,
} from './lib/importManifest';
import {
  type CommitConfirmation,
  type ParsedStatementName,
  commitConfirmation,
  isLocalTarget,
  parseImportArguments,
  parseStatementName,
} from './lib/importStatements';
import {
  cardFeeNotice,
  describePlanItem,
  reviewReminder,
} from './lib/reconciliationTable';
import type { ReconciliationPreviewItem } from '../src/shared/types/import';
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
  | 'mergedIntoImportId'
  | 'mergedIntoFileName'
>;

/** Every submitted import followed to the import its rows ended up in. */
type WaitedImports = {
  byId: Map<string, ImportRecord>;
  finalIdBySubmittedId: Map<string, string>;
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
  // Taken from the manifest rather than uploaded on this run.
  reused: boolean;
};

type ResolvedTarget = {
  importRecord: ImportRecord;
};

type PlannedImport = {
  importRecord: ImportRecord;
  plan: ReconciliationPreviewItem[];
};

async function main(): Promise<void> {
  const { directory, dryRun, baseUrl, resubmit } = parseImportArguments(
    process.argv.slice(2),
  );
  const token = await resolveToken();

  const client = createApiClient(baseUrl, token);
  const statements = await collectStatements(directory);
  if (statements.length === 0) {
    throw new Error(
      `No ${IMPORTABLE_EXTENSIONS.join('/')} files found in ${directory}`,
    );
  }

  reportTarget(baseUrl, dryRun);
  reportStatements(statements);

  const manifestPath = join(directory, MANIFEST_FILE_NAME);
  let manifest = await loadManifest(manifestPath);

  const submitted: SubmittedStatement[] = [];
  for (const statement of statements) {
    const recorded = resubmit
      ? undefined
      : recordedImport(manifest, baseUrl, statement.fileName);
    if (recorded) {
      submitted.push({ statement, importId: recorded.importId, reused: true });
      console.log(
        `  reusing import ${recorded.importId} for ${statement.fileName} (submitted ${recorded.submittedAt})`,
      );
      continue;
    }

    const importId = await submitStatement(client, statement);
    submitted.push({ statement, importId, reused: false });
    // Saved per file, so an interrupted run still knows what it uploaded.
    manifest = withSubmission(
      manifest,
      baseUrl,
      statement.fileName,
      importId,
      new Date(),
    );
    await saveManifest(manifestPath, manifest);
    console.log(`  submitted ${statement.fileName} -> ${importId}`);
  }

  console.log('\nWaiting for extraction to finish...');
  const waited = await waitForImports(
    client,
    submitted.map((entry) => entry.importId),
  );
  const { targets, importIdByFileName } = resolveTargets(submitted, waited);
  reportFailedImports(targets);

  const planned = await loadPlans(client, targets);
  renderPlanTable(planned);
  reportPlanDrift(planned, manifest, baseUrl);
  for (const [fileName, importId] of importIdByFileName) {
    manifest = withResolvedImport(manifest, baseUrl, fileName, importId);
  }
  manifest = recordPreviews(planned, manifest, baseUrl);
  await saveManifest(manifestPath, manifest);

  const totals = countActions(planned);
  if (totals.merge + totals.create === 0) {
    console.log('\nNothing pending to reconcile.');
    return;
  }

  const items = planned.flatMap(({ plan }) => plan);
  const reminder = reviewReminder(items);
  if (reminder) {
    console.log(`\n${reminder}`);
  }

  const feeNotice = cardFeeNotice(items);
  if (feeNotice) {
    console.log(`\n${feeNotice}`);
  }

  if (dryRun) {
    console.log('\n--dry-run: nothing was approved, ignored or created.');
    return;
  }

  const approved = await confirm(commitConfirmation(baseUrl, totals));
  if (!approved) {
    console.log('Aborted; nothing was written.');
    return;
  }

  await commitPlans(client, planned);
  // The approved rows are no longer pending, so the next run's empty plan is
  // the expected state, not drift.
  manifest = recordPreviews(
    planned.map(({ importRecord }) => ({ importRecord, plan: [] })),
    manifest,
    baseUrl,
  );
  await saveManifest(manifestPath, manifest);
}

/**
 * The token is a live session for whichever site the run targets, so it is
 * read from the environment or a file rather than taken as an argument that
 * would land in shell history.
 */
async function resolveToken(): Promise<string> {
  const fromEnvironment = process.env.IMPORT_API_TOKEN;
  if (fromEnvironment) {
    return fromEnvironment;
  }

  const tokenFile = process.env.IMPORT_API_TOKEN_FILE;
  if (tokenFile) {
    const contents = await readFile(tokenFile, 'utf8');
    const token = contents.trim();
    if (!token) {
      throw new Error(`IMPORT_API_TOKEN_FILE is empty: ${tokenFile}`);
    }
    return token;
  }

  throw new Error(
    'Set IMPORT_API_TOKEN (dev:local prints one as "Bearer" on startup) or IMPORT_API_TOKEN_FILE',
  );
}

async function loadManifest(path: string): Promise<ImportManifest> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    if (isMissingFile(error)) {
      return emptyManifest();
    }
    throw error;
  }
  return parseManifest(text, path);
}

async function saveManifest(
  path: string,
  manifest: ImportManifest,
): Promise<void> {
  await writeFile(path, serializeManifest(manifest), 'utf8');
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

/**
 * A plan that differs from the one previewed last time means something wrote
 * to the import in between — another upload merged into it, a rematch, the
 * web UI — and the table above is not the one the human already read.
 */
function reportPlanDrift(
  planned: PlannedImport[],
  manifest: ImportManifest,
  baseUrl: string,
): void {
  for (const { importRecord, plan } of planned) {
    const previous = recordedPreview(manifest, baseUrl, importRecord.id);
    if (!previous) {
      continue;
    }
    const drift = planDrift(
      previous.rowIds,
      plan.map((item) => item.importedTransactionId),
    );
    if (drift.added === 0 && drift.removed === 0) {
      continue;
    }
    console.log(
      `\n  WARNING ${importRecord.originalFileName}: the plan changed since the preview at ${previous.previewedAt} (+${drift.added} row(s), -${drift.removed} row(s)); read the table above again before approving`,
    );
  }
}

function recordPreviews(
  planned: PlannedImport[],
  manifest: ImportManifest,
  baseUrl: string,
): ImportManifest {
  const now = new Date();
  return planned.reduce(
    (current, { importRecord, plan }) =>
      withPreview(
        current,
        baseUrl,
        importRecord.id,
        plan.map((item) => item.importedTransactionId),
        now,
      ),
    manifest,
  );
}

/**
 * Printed before the first upload, since even a dry run creates imports on
 * the target — a wrong site has to be visible before that, not at the commit
 * prompt.
 */
function reportTarget(baseUrl: string, dryRun: boolean): void {
  const mode = dryRun ? 'dry run: previews, approves nothing' : 'commit run';
  const remoteWarning = isLocalTarget(baseUrl) ? '' : '  <-- not local';
  console.log(`Target ${baseUrl} (${mode})${remoteWarning}\n`);
}

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
 * Polls each import by id until none is in flight, following a merge to the
 * import the rows went into. A survivor is held in REMATCHING until those rows
 * are matched, so a terminal status means the preview is the whole story.
 */
async function waitForImports(
  client: ApiClient,
  submittedIds: string[],
): Promise<WaitedImports> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let interval = FIRST_POLL_INTERVAL_MS;
  const finalIdBySubmittedId = new Map(submittedIds.map((id) => [id, id]));
  const byId = new Map<string, ImportRecord>();

  while (Date.now() < deadline) {
    const tracked = [...new Set(finalIdBySubmittedId.values())];
    const records = await Promise.all(
      tracked.map((id) => fetchImport(client, id)),
    );

    let stillRunning = 0;
    for (const record of records) {
      if (!record) {
        continue;
      }
      byId.set(record.id, record);
      if (record.status === ImportStatus.MERGED && record.mergedIntoImportId) {
        followMerge(finalIdBySubmittedId, record, record.mergedIntoImportId);
        // The survivor is fetched on the next tick.
        stillRunning += 1;
        continue;
      }
      if (ACTIVE_IMPORT_STATUSES.includes(record.status)) {
        stillRunning += 1;
      }
    }

    if (stillRunning === 0) {
      return { byId, finalIdBySubmittedId };
    }

    await sleep(interval);
    interval = Math.min(interval * 2, MAX_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Extraction did not finish within ${POLL_TIMEOUT_MS / 1000}s; check the imports page`,
  );
}

function followMerge(
  finalIdBySubmittedId: Map<string, string>,
  merged: ImportRecord,
  survivorId: string,
): void {
  for (const [submittedId, currentId] of finalIdBySubmittedId) {
    if (currentId === merged.id) {
      finalIdBySubmittedId.set(submittedId, survivorId);
    }
  }
  console.log(
    `  ${merged.originalFileName}: duplicate of an earlier import for the same card and month; its rows moved into ${merged.mergedIntoFileName ?? survivorId}`,
  );
}

async function fetchImport(
  client: ApiClient,
  importId: string,
): Promise<ImportRecord | undefined> {
  try {
    return await client.getJson<ImportRecord>(`/api/imports/${importId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return undefined;
    }
    throw error;
  }
}

function resolveTargets(
  submitted: SubmittedStatement[],
  waited: WaitedImports,
): {
  targets: ResolvedTarget[];
  importIdByFileName: Map<string, string>;
} {
  const resolved = new Map<string, ResolvedTarget>();
  const importIdByFileName = new Map<string, string>();

  for (const { statement, importId, reused } of submitted) {
    const finalId = waited.finalIdBySubmittedId.get(importId) ?? importId;
    const target = waited.byId.get(finalId);
    if (!target) {
      const hint = reused
        ? `import ${importId} recorded in ${MANIFEST_FILE_NAME} no longer exists; run again with --resubmit to upload it afresh`
        : 'reconcile it from the imports page';
      console.log(
        `  could not locate the import for ${statement.fileName}; ${hint}`,
      );
      continue;
    }
    resolved.set(target.id, { importRecord: target });
    importIdByFileName.set(statement.fileName, target.id);
  }

  return { targets: [...resolved.values()], importIdByFileName };
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
      plan: await client.getJson<ReconciliationPreviewItem[]>(
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

async function confirm(confirmation: CommitConfirmation): Promise<boolean> {
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await readline.question(confirmation.prompt);
    return confirmation.accepts(answer);
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
