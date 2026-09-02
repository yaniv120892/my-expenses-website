import http from 'http';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { hash } from 'bcryptjs';
import { Client } from 'pg';
import {
  getRecording,
  resetRecording,
  CHUNK_DELAY_MS,
} from './mockModelServer';
import { USER_B_MARKERS } from './seed';
import { MOCK_PORT, SHIM_PORT, EXTRACTION_PORT } from './ports';
import { startStack } from './stack';

const execFileAsync = promisify(execFile);

const APP_PORT = Number(process.env.PORT || 3000);

interface Frame {
  at: number;
  type: string;
  value?: string;
  message?: string;
}

const results: { name: string; ok: boolean; detail: string }[] = [];

function check(name: string, ok: boolean, detail = ''): void {
  results.push({ name, ok, detail });
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`,
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Posts to /api/chat and returns each SSE frame with the time it arrived. */
function streamChat(
  token: string | null,
  text: string,
  opts: { abortAfterFirstDelta?: boolean } = {},
): Promise<{ status: number; contentType: string; frames: Frame[] }> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ messages: [{ sender: 'user', text }] });
    const req = http.request(
      {
        host: '127.0.0.1',
        port: APP_PORT,
        path: '/api/chat',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        const frames: Frame[] = [];
        let buffer = '';
        const started = Date.now();
        const finish = () =>
          resolve({
            status: res.statusCode || 0,
            contentType: String(res.headers['content-type'] || ''),
            frames,
          });

        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';
          for (const part of parts) {
            const line = part.split('\n').find((l) => l.startsWith('data: '));
            if (!line) {
              continue;
            }
            try {
              const parsed = JSON.parse(line.slice(6));
              frames.push({ ...parsed, at: Date.now() - started });
              if (opts.abortAfterFirstDelta && parsed.type === 'delta') {
                req.destroy();
                finish();
              }
            } catch {
              /* non-JSON frame */
            }
          }
        });

        res.on('end', finish);
      },
    );

    req.on('error', (err) => {
      if (opts.abortAfterFirstDelta) {
        return;
      }
      reject(err);
    });
    req.write(body);
    req.end();
  });
}

async function waitForApp(timeoutMs = 120_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await streamChat(null, 'ping');
      if (res.status) {
        return true;
      }
    } catch {
      /* not up yet */
    }
    await sleep(1000);
  }
  return false;
}

async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();
  try {
    const res = await client.query(sql, params);
    return res.rows as T[];
  } finally {
    await client.end();
  }
}

interface ApiResult {
  status: number;
  headers: Headers;
  body: unknown;
}

/** Plain JSON request against the app; `rawBody` skips serialisation. */
async function api(
  method: string,
  path: string,
  opts: {
    token?: string;
    cookie?: string;
    body?: unknown;
    rawBody?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<ApiResult> {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.token) {
    headers.Authorization = `Bearer ${opts.token}`;
  }
  if (opts.cookie) {
    headers.Cookie = opts.cookie;
  }
  let body: string | undefined;
  if (opts.rawBody !== undefined) {
    body = opts.rawBody;
    headers['Content-Type'] = 'application/json';
  } else if (opts.body !== undefined) {
    body = JSON.stringify(opts.body);
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`http://127.0.0.1:${APP_PORT}${path}`, {
    method,
    headers,
    body,
  });
  const text = await res.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* non-JSON body */
  }
  return { status: res.status, headers: res.headers, body: parsed };
}

/** Reads a key straight from the upstash shim, bypassing the app. */
async function redisGet(key: string): Promise<unknown> {
  const res = await fetch(`http://127.0.0.1:${SHIM_PORT}`, {
    method: 'POST',
    body: JSON.stringify(['get', key]),
  });
  const parsed = (await res.json()) as { result: unknown };
  return parsed.result;
}

/** Collapses a multi-line value into a one-line snippet for check details. */
function preview(text: string, max = 160): string {
  return text.replace(/\n/g, ' | ').slice(0, max);
}

function textOf(frames: Frame[]): string {
  return frames
    .filter((f) => f.type === 'delta')
    .map((f) => f.value || '')
    .join('');
}

/**
 * Login → me → logout against a user of its own: logout deletes the session
 * key, so running this against a seeded user would invalidate the token the
 * other checks share. Must run inside the harness — the cookie session is only
 * valid while the upstash shim holds that key.
 */
async function authLifecycleFlow(): Promise<void> {
  const email = 'login-flow@e2e.test';
  const password = 'e2e-login-password';
  const [user] = await query<{ id: string }>(
    `insert into "User" (id, username, email, password, verified)
     values (gen_random_uuid(), 'e2e-login-flow', $1, $2, true)
     returning id`,
    [email, await hash(password, 10)],
  );

  const login = await api('POST', '/api/auth/login', {
    body: { email, password },
  });
  const loginBody = (login.body ?? {}) as { success?: boolean; token?: string };
  const token = loginBody.token || '';
  const setCookie = login.headers.get('set-cookie') || '';
  check(
    'auth: login succeeds and sets the session cookie',
    login.status === 200 &&
      loginBody.success === true &&
      setCookie.includes('session='),
    `status ${login.status}`,
  );

  const sessionKey = `session:${user.id}:${token}`;
  check(
    'auth: login stores the redis session key',
    (await redisGet(sessionKey)) !== null,
  );

  const cookie = `session=${token}`;
  const me = await api('GET', '/api/auth/me', { cookie });
  const meBody = (me.body ?? {}) as { email?: string };
  check(
    'auth: me returns the logged-in user via cookie',
    me.status === 200 && meBody.email === email,
    `status ${me.status}, email ${meBody.email}`,
  );

  const logout = await api('POST', '/api/auth/logout', { cookie });
  check(
    'auth: logout removes the redis session key',
    logout.status === 200 && (await redisGet(sessionKey)) === null,
    `status ${logout.status}`,
  );

  const meAfter = await api('GET', '/api/auth/me', { cookie });
  check(
    'auth: me after logout is rejected',
    meAfter.status === 401,
    `status ${meAfter.status}`,
  );
}

/** Create → list → summary → status transitions → delete, plus the limit cap. */
async function transactionLifecycleFlow(token: string): Promise<void> {
  const [category] = await query<{ id: string }>(
    `select id from "Category" where name = 'Groceries'`,
  );

  const created = await api('POST', '/api/transactions', {
    token,
    body: {
      description: 'E2E lifecycle transaction',
      value: 123.45,
      type: 'EXPENSE',
      categoryId: category.id,
      // Mid-range date so start/endOfDay normalisation cannot exclude it.
      date: '2026-08-02T12:00:00.000Z',
    },
  });
  const txId = (created.body as { id?: string } | null)?.id || '';
  check(
    'transactions: POST creates and returns an id',
    created.status === 201 && txId.length > 0,
    `status ${created.status}`,
  );

  const listPath =
    '/api/transactions?limit=10&startDate=2026-08-01&endDate=2026-08-03';
  const listItems = (res: ApiResult) =>
    (res.body as { items?: { id: string }[] } | null)?.items ?? [];
  const inList = (res: ApiResult) => listItems(res).some((t) => t.id === txId);

  const list = await api('GET', listPath, { token });
  check(
    'transactions: created transaction appears in the list',
    list.status === 200 && inList(list),
    `status ${list.status}`,
  );

  const summary = await api(
    'GET',
    '/api/transactions/summary?startDate=2026-08-01&endDate=2026-08-03',
    { token },
  );
  const summaryBody = summary.body as {
    totalExpense?: number;
    count?: number;
  } | null;
  check(
    'transactions: summary reflects the new expense',
    summaryBody?.totalExpense === 123.45,
    `totalExpense ${summaryBody?.totalExpense}`,
  );
  check(
    'transactions: summary counts the rows behind the totals',
    (summaryBody?.count ?? 0) >= 1,
    `count ${summaryBody?.count}`,
  );

  // The totals sit above a paged list, so a search must narrow both or the
  // header would describe rows the list never shows.
  // Upper-cased to prove the search is case-insensitive.
  const searchQuery =
    'searchTerm=LIFECYCLE&startDate=2026-08-01&endDate=2026-08-03';
  const searchedList = await api(
    'GET',
    `/api/transactions?limit=10&${searchQuery}`,
    {
      token,
    },
  );
  const searchedSummary = await api(
    'GET',
    `/api/transactions/summary?${searchQuery}`,
    { token },
  );
  const searchedCount = (searchedSummary.body as { count?: number } | null)
    ?.count;
  check(
    'transactions: search narrows the list and the summary alike',
    listItems(searchedList).length === searchedCount && inList(searchedList),
    `list ${listItems(searchedList).length} vs count ${searchedCount}`,
  );

  const pended = await api('PATCH', `/api/transactions/${txId}/status`, {
    token,
    body: { status: 'PENDING_APPROVAL' },
  });
  const listPending = await api('GET', listPath, { token });
  check(
    'transactions: PENDING_APPROVAL hides it from the approved list',
    pended.status === 200 && !inList(listPending),
    `status ${pended.status}`,
  );

  const approved = await api('PATCH', `/api/transactions/${txId}/status`, {
    token,
    body: { status: 'APPROVED' },
  });
  const listApproved = await api('GET', listPath, { token });
  check(
    'transactions: re-approval returns it to the list',
    approved.status === 200 && inList(listApproved),
    `status ${approved.status}`,
  );

  const deleted = await api('DELETE', `/api/transactions/${txId}`, { token });
  const listAfterDelete = await api('GET', listPath, { token });
  check(
    'transactions: DELETE removes it',
    deleted.status === 200 && !inList(listAfterDelete),
    `status ${deleted.status}`,
  );

  // Regression: the limit schema caps at 100.
  const oversized = await api('GET', '/api/transactions?limit=1000', {
    token,
  });
  check(
    'transactions: limit above 100 is rejected',
    oversized.status === 400,
    `status ${oversized.status}`,
  );

  const badCursor = await api('GET', '/api/transactions?cursor=not-a-cursor', {
    token,
  });
  check(
    'transactions: a malformed cursor is rejected',
    badCursor.status === 400,
    `status ${badCursor.status}`,
  );
}

/** Walking every page by cursor visits each row exactly once. */
async function transactionCursorPagingFlow(
  token: string,
  userId: string,
): Promise<void> {
  const seen: string[] = [];
  let cursor: string | undefined;

  for (let request = 0; request < 20; request++) {
    const path = `/api/transactions?limit=3${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const res: ApiResult = await api('GET', path, { token });
    const body = res.body as {
      items: { id: string }[];
      nextCursor: string | null;
    } | null;
    if (res.status !== 200 || !body) {
      check(
        'transactions: cursor paging walks the list',
        false,
        `status ${res.status}`,
      );
      return;
    }
    seen.push(...body.items.map((item) => item.id));
    if (!body.nextCursor) {
      break;
    }
    cursor = body.nextCursor;
  }

  const total = await query<{ count: string }>(
    `select count(*) as count from "Transaction" where status = 'APPROVED' and "userId" = $1`,
    [userId],
  );
  const expected = Number(total[0].count);
  check(
    'transactions: cursor paging returns every row exactly once',
    seen.length === expected && new Set(seen).size === seen.length,
    `walked ${seen.length}, unique ${new Set(seen).size}, expected ${expected}`,
  );
}

/** A due schedule is claimed first, materialised as PENDING_APPROVAL. */
async function scheduledCronFlow(userId: string): Promise<void> {
  const [category] = await query<{ id: string }>(
    `select id from "Category" where name = 'Rent'`,
  );
  const description = 'E2E due schedule';
  const [schedule] = await query<{ id: string }>(
    `insert into "ScheduledTransaction"
       (id, description, value, type, "categoryId", "scheduleType", "userId", "nextRunDate")
     values (gen_random_uuid(), $1, 55, 'EXPENSE', $2, 'DAILY', $3, now() - interval '1 day')
     returning id`,
    [description, category.id, userId],
  );

  const unauthed = await api('GET', '/api/scheduled-transactions/process');
  check(
    'cron: process without the secret is rejected',
    unauthed.status === 401,
    `status ${unauthed.status}`,
  );

  const run = await api('GET', '/api/scheduled-transactions/process', {
    token: process.env.CRON_SECRET || 'e2e',
  });
  check(
    'cron: process with CRON_SECRET succeeds',
    run.status === 200,
    `status ${run.status}`,
  );

  const txRows = await query<{ status: string }>(
    `select status from "Transaction" where "userId" = $1 and description = $2`,
    [userId, description],
  );
  check(
    'cron: due schedule created a PENDING_APPROVAL transaction',
    txRows.length === 1 && txRows[0].status === 'PENDING_APPROVAL',
    txRows.length
      ? `${txRows.length} row(s), status ${txRows[0].status}`
      : 'no transaction created',
  );

  // Regression for the claim-first fix: the schedule must not stay due.
  const [after] = await query<{ future: boolean }>(
    `select "nextRunDate" > now() as future from "ScheduledTransaction" where id = $1`,
    [schedule.id],
  );
  check('cron: nextRunDate advanced into the future', after?.future === true);
}

/**
 * The dev server runs without TELEGRAM_WEBHOOK_SECRET, so the route must fail
 * closed for every request. The positive ack path needs the secret set at
 * server start and is intentionally not covered here.
 */
async function telegramWebhookFlow(): Promise<void> {
  const noHeader = await api('POST', '/api/webhook', {
    body: { update_id: 1 },
  });
  check(
    'telegram: webhook without secret header is rejected',
    noHeader.status === 401,
    `status ${noHeader.status}`,
  );

  const withHeader = await api('POST', '/api/webhook', {
    body: { update_id: 1 },
    headers: { 'x-telegram-bot-api-secret-token': 'guess' },
  });
  check(
    'telegram: webhook with a wrong/unconfigured secret is rejected',
    withHeader.status === 401,
    `status ${withHeader.status}`,
  );
}

/** HMAC auth and the malformed-JSON guard on the extraction webhook. */
async function excelWebhookFlow(userId: string): Promise<void> {
  const payload = {
    requestId: 'e2e-unknown-request',
    status: 'FAILED',
    error: 'boom',
  };

  const missingAuth = await api('POST', '/api/excel-extraction-agent/webhook', {
    body: payload,
  });
  check(
    'excel webhook: missing auth params are rejected',
    missingAuth.status === 401,
    `status ${missingAuth.status}`,
  );

  // Regression: the JSON guard must answer 400, not crash the handler.
  const badJson = await api('POST', '/api/excel-extraction-agent/webhook', {
    rawBody: '{not json',
  });
  check(
    'excel webhook: malformed JSON body gets 400',
    badJson.status === 400 &&
      (badJson.body as { error?: string } | null)?.error ===
        'Invalid JSON body',
    `status ${badJson.status}`,
  );

  const secret = process.env.EXCEL_EXTRACTION_AGENT_WEBHOOK_SECRET;
  const timestamp = Date.now();
  if (secret) {
    // Only meaningful when the dev server was started with the same secret:
    // a valid HMAC must pass auth and reach processing (404 = unknown request).
    const token = crypto
      .createHmac('sha256', secret)
      .update(`${userId}:${timestamp}`)
      .digest('base64url');
    const authed = await api(
      'POST',
      `/api/excel-extraction-agent/webhook?token=${token}&userId=${userId}&timestamp=${timestamp}`,
      { body: payload },
    );
    check(
      'excel webhook: valid HMAC reaches processing (404 for unknown request)',
      authed.status === 404,
      `status ${authed.status}`,
    );

    // The importId is signed too, so a callback cannot be pointed at another
    // import by editing the query string.
    const importId = '00000000-0000-4000-8000-000000000000';
    const boundToken = crypto
      .createHmac('sha256', secret)
      .update(`${userId}:${timestamp}:${importId}`)
      .digest('base64url');
    const bound = await api(
      'POST',
      `/api/excel-extraction-agent/webhook?token=${boundToken}&userId=${userId}&timestamp=${timestamp}&importId=${importId}`,
      { body: payload },
    );
    check(
      'excel webhook: importId-bound HMAC reaches processing',
      bound.status === 404,
      `status ${bound.status}`,
    );

    const tampered = await api(
      'POST',
      `/api/excel-extraction-agent/webhook?token=${token}&userId=${userId}&timestamp=${timestamp}&importId=${importId}`,
      { body: payload },
    );
    check(
      'excel webhook: an importId added after signing is rejected',
      tampered.status === 401,
      `status ${tampered.status}`,
    );
  } else {
    // Without the secret env on the server, verification cannot run and the
    // processor must fail closed rather than accept the payload.
    const failClosed = await api(
      'POST',
      `/api/excel-extraction-agent/webhook?token=x&userId=${userId}&timestamp=${timestamp}`,
      { body: payload },
    );
    check(
      'excel webhook: fails closed when the server has no secret configured',
      failClosed.status === 500,
      `status ${failClosed.status}`,
    );
  }
}

interface ImportRecord {
  id: string;
  status: string;
  creditCardLastFourDigits: string | null;
}

/** Fresh per run, so an import can never be deduplicated into an older one. */
function randomCardDigits(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function waitForImportCompletion(
  token: string,
  importId: string,
  timeoutMs = 30_000,
): Promise<ImportRecord | undefined> {
  const deadline = Date.now() + timeoutMs;
  let found: ImportRecord | undefined;
  while (Date.now() < deadline) {
    const listed = await api('GET', '/api/imports', { token });
    const imports = Array.isArray(listed.body)
      ? (listed.body as ImportRecord[])
      : [];
    found = imports.find((record) => record.id === importId);
    const settled =
      found && found.status !== 'PENDING' && found.status !== 'PROCESSING';
    if (settled) {
      return found;
    }
    await sleep(500);
  }
  return found;
}

/**
 * The encrypted column, written and read through the app's own client and then
 * inspected raw. Reading the digits back proves the extension decrypts; the raw
 * column proves it encrypted rather than silently storing plaintext.
 */
async function importEncryptionFlow(token: string): Promise<void> {
  const digits = randomCardDigits();
  const originalFileName = `card-${digits}_03_2026.csv`;
  const fileUrl = `https://${process.env.IMPORTS_S3_BUCKET}.s3.${process.env.IMPORTS_S3_REGION}.amazonaws.com/imports/${originalFileName}`;

  const created = await api('POST', '/api/imports/process', {
    token,
    body: { fileUrl, originalFileName },
  });
  const importId = (created.body as { id?: string } | null)?.id;
  check(
    'imports: process accepts a file URL inside the imports bucket',
    created.status === 200 && Boolean(importId),
    `status ${created.status}`,
  );
  if (!importId) {
    return;
  }

  const completed = await waitForImportCompletion(token, importId);
  check(
    'imports: the extraction callback completed the import',
    completed?.status === 'COMPLETED',
    `status ${completed?.status ?? 'import never listed'}`,
  );
  check(
    'imports: card digits decrypt back through the app client',
    completed?.creditCardLastFourDigits === digits,
    `read ${completed?.creditCardLastFourDigits}, submitted ${digits}`,
  );

  const [stored] = await query<{ creditCardLastFourDigits: string | null }>(
    'select "creditCardLastFourDigits" from "Import" where id = $1',
    [importId],
  );
  const atRest = stored?.creditCardLastFourDigits;
  check(
    'imports: card digits are ciphertext at rest',
    Boolean(atRest) && atRest !== digits,
    atRest === digits ? 'the column holds the plaintext digits' : `${atRest}`,
  );
}

async function main(): Promise<void> {
  const { seeded, stop: shutdown } = await startStack({
    mock: MOCK_PORT,
    shim: SHIM_PORT,
    extraction: EXTRACTION_PORT,
  });
  console.log(
    `mock model on ${MOCK_PORT}, upstash shim on ${SHIM_PORT}, extraction agent on ${EXTRACTION_PORT}`,
  );
  console.log('seeded users', seeded.userA.id, seeded.userB.id);

  if (!(await waitForApp())) {
    throw new Error('App did not become reachable');
  }

  // Mastra creates its storage lazily, on first use — the schema checks below
  // only mean anything after at least one request has gone through.
  const warmup = await streamChat(seeded.userA.token, 'Hello');
  const warmupError = warmup.frames.find((f) => f.type === 'error');
  check(
    'warm-up request succeeded without an error frame',
    warmup.status === 200 && !warmupError,
    warmupError
      ? `error frame: ${warmupError.message}`
      : `status ${warmup.status}`,
  );

  const schemas = await query<{ nspname: string }>(
    `select nspname from pg_namespace where nspname = 'mastra'`,
  );
  check('mastra schema created', schemas.length === 1);

  const mastraTables = await query<{ count: string }>(
    `select count(*)::text as count from information_schema.tables where table_schema='mastra'`,
  );
  check(
    'mastra tables live outside public',
    Number(mastraTables[0]?.count) > 0,
    `${mastraTables[0]?.count} tables`,
  );

  const { stdout } = await execFileAsync(
    'npx',
    ['prisma', 'migrate', 'status'],
    { env: process.env, timeout: 180_000 },
  ).catch((e) => ({ stdout: String(e.stdout || e) }));
  check(
    'prisma reports no drift after mastra schema exists',
    /up to date/i.test(stdout),
    stdout.trim().split('\n').slice(-1)[0],
  );

  const unauth = await streamChat(null, 'How much did I spend?');
  check(
    'unauthenticated request rejected',
    unauth.status === 401,
    `status ${unauth.status}`,
  );

  resetRecording();
  const compare = await streamChat(
    seeded.userA.token,
    'Compare my grocery spending in January versus February',
  );
  const compareText = textOf(compare.frames);

  check(
    'authenticated request streams SSE',
    compare.status === 200 && compare.contentType.includes('text/event-stream'),
    `${compare.status} ${compare.contentType}`,
  );

  const deltas = compare.frames.filter((f) => f.type === 'delta');
  const spread = deltas.length
    ? deltas[deltas.length - 1].at - deltas[0].at
    : 0;
  // Half the mock's chunk gap: the property under test is only "these did not
  // arrive together", and 60ms sits far above timer jitter.
  const minSpread = CHUNK_DELAY_MS / 2;
  check(
    'deltas arrive incrementally, not in one burst',
    deltas.length > 1 && spread >= minSpread,
    `${deltas.length} deltas spread over ${spread}ms (need >= ${minSpread}ms)`,
  );

  const rec = getRecording();
  const compareCalls = rec.toolCalls.filter((c) => c.name === 'comparePeriods');
  check(
    'agent called comparePeriods once',
    compareCalls.length === 1,
    `tools called: ${rec.toolCalls.map((c) => c.name).join(', ') || 'none'}`,
  );

  check(
    'all five tools were offered to the model',
    [
      'listCategories',
      'listTransactions',
      'summarizeTransactions',
      'comparePeriods',
      'getSpendingTrends',
    ].every((t) => rec.toolsOffered.includes(t)),
    rec.toolsOffered.join(', '),
  );

  // The decisive check: the difference and percentage came from TypeScript.
  const toolOutput = rec.toolResults.join('\n');
  check(
    'tool result contains the TS-computed difference',
    toolOutput.includes('1,100.00'),
    preview(toolOutput),
  );
  check(
    'tool result contains the TS-computed percentage',
    toolOutput.includes('26.83%'),
  );
  check(
    'those figures reached the user',
    compareText.includes('1,100.00') && compareText.includes('26.83%'),
  );

  const leaked = USER_B_MARKERS.filter((m) => compareText.includes(m));
  check(
    "user B's amounts never appear in user A's answer",
    leaked.length === 0,
    leaked.length ? `leaked: ${leaked.join(', ')}` : 'no leakage',
  );

  resetRecording();
  const bStream = await streamChat(
    seeded.userB.token,
    'Compare my grocery spending in January versus February',
  );
  const bText = textOf(bStream.frames);
  check(
    "user B sees only user B's data",
    bText.includes('7,777') &&
      bText.includes('8,888') &&
      !bText.includes('4,100'),
    preview(bText),
  );

  resetRecording();
  const share = await streamChat(
    seeded.userA.token,
    'What percentage of my spending was by category?',
  );
  const shareRec = getRecording();
  check(
    'category breakdown returns shares computed in TS',
    shareRec.toolResults.join('\n').includes('%'),
    preview(shareRec.toolResults.join('\n')),
  );
  check('share answer reached the user', textOf(share.frames).includes('%'));

  const threads = await query<{ count: string }>(
    `select count(*)::text as count from mastra.mastra_threads`,
  ).catch(() => [{ count: '0' }]);
  check(
    'memory persisted conversation threads',
    Number(threads[0]?.count) > 0,
    `${threads[0]?.count} threads`,
  );

  resetRecording();
  await streamChat(seeded.userA.token, 'Compare January versus February', {
    abortAfterFirstDelta: true,
  });
  const callsAtAbort = getRecording().requestCount;
  await sleep(2500);
  const callsAfter = getRecording().requestCount;
  check(
    'client disconnect stops the agent run',
    callsAfter === callsAtAbort,
    `model requests ${callsAtAbort} → ${callsAfter}`,
  );

  // Regression guard: an abrupt disconnect must not take the server down.
  const afterAbort = await streamChat(null, 'still alive?').catch(() => null);
  check(
    'app survives an abrupt client disconnect',
    afterAbort?.status === 401,
    afterAbort ? `status ${afterAbort.status}` : 'app unreachable — it crashed',
  );

  await authLifecycleFlow();
  await transactionLifecycleFlow(seeded.userA.token);
  await transactionCursorPagingFlow(seeded.userA.token, seeded.userA.id);
  await scheduledCronFlow(seeded.userA.id);
  await telegramWebhookFlow();
  await excelWebhookFlow(seeded.userA.id);
  await importEncryptionFlow(seeded.userA.token);

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed`,
  );
  shutdown();

  if (failed.length) {
    console.log('FAILED:', failed.map((f) => f.name).join('; '));
    process.exit(1);
  }
  process.exit(0);
}

main().catch((error) => {
  console.error('harness error:', error);
  process.exit(1);
});
