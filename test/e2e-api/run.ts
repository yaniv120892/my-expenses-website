import http from 'http';
import crypto from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { hash } from 'bcryptjs';
import { Client } from 'pg';
import { getRecording, resetRecording, CHUNK_DELAY_MS } from './mockModelServer';
import { USER_B_MARKERS } from './seed';
import { MOCK_PORT, SHIM_PORT, EXTRACTION_PORT, EXTRACTION_MOCK_PORT } from './ports';
import { redisKeyPrefix } from '../../src/server/redis';
import { withVerifyFullSslMode } from '../../src/server/db/sslMode';
import { requireEnv } from '../../src/server/env';
import { buildImportObjectKey } from '../../src/server/utils/importObjectKey';
import { ACTIVE_IMPORT_STATUSES } from '../../src/utils/importStatus';
import { IS_HOUSEHOLD_OWNED } from '../../src/server/db/householdScope';
import type { ImportStatus } from '../../src/shared/types/import';
import {
  CIPHERTEXT_FROM_AN_EARLIER_CLIENT,
  DIGITS_BEHIND_THAT_CIPHERTEXT,
} from '../../src/test/encryptionFixture';
import { startStack } from './stack';

const execFileAsync = promisify(execFile);

const APP_PORT = Number(process.env.PORT || 3000);

type Frame = {
  at: number;
  type: string;
  value?: string;
  message?: string;
};

const results: { name: string; ok: boolean; detail: string }[] = [];

function check(name: string, ok: boolean, detail = ''): void {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function streamChat(
  token: string | null,
  text: string,
  options: { abortAfterFirstDelta?: boolean } = {},
): Promise<{ status: number; contentType: string; frames: Frame[] }> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ messages: [{ sender: 'user', text }] });
    const request = http.request(
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
      (response) => {
        const frames: Frame[] = [];
        let buffer = '';
        const started = Date.now();
        const finish = () =>
          resolve({
            status: response.statusCode || 0,
            contentType: String(response.headers['content-type'] || ''),
            frames,
          });

        response.on('data', (chunk) => {
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
              if (options.abortAfterFirstDelta && parsed.type === 'delta') {
                request.destroy();
                finish();
              }
            } catch {
              /* non-JSON frame */
            }
          }
        });

        response.on('end', finish);
      },
    );

    request.on('error', (error) => {
      if (options.abortAfterFirstDelta) {
        return;
      }
      reject(error);
    });
    request.write(body);
    request.end();
  });
}

async function waitForApp(timeoutMs = 120_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await streamChat(null, 'ping');
      if (response.status) {
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
  const client = new Client({
    connectionString: withVerifyFullSslMode(requireEnv('DIRECT_URL')),
  });
  await client.connect();
  try {
    const result = await client.query(sql, params);
    const rows: T[] = result.rows;
    return rows;
  } finally {
    await client.end();
  }
}

type ApiResult<TBody = unknown> = {
  status: number;
  headers: Headers;
  body: TBody | null;
};

// The type argument names the shape a check expects; the harness asserts on the values, so a
// mismatched body fails the check rather than being validated here.
async function api<TBody = unknown>(
  method: string,
  path: string,
  options: {
    token?: string;
    cookie?: string;
    body?: unknown;
    rawBody?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<ApiResult<TBody>> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.cookie) {
    headers.Cookie = options.cookie;
  }
  let body: string | undefined;
  if (options.rawBody !== undefined) {
    body = options.rawBody;
    headers['Content-Type'] = 'application/json';
  } else if (options.body !== undefined) {
    body = JSON.stringify(options.body);
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`http://127.0.0.1:${APP_PORT}${path}`, {
    method,
    headers,
    body,
  });
  const text = await response.text();
  let parsed: TBody | null = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* non-JSON body */
  }
  return { status: response.status, headers: response.headers, body: parsed };
}

function errorCode(result: ApiResult): string | undefined {
  const body = result.body;
  if (typeof body !== 'object' || body === null || !('code' in body)) {
    return undefined;
  }
  return typeof body.code === 'string' ? body.code : undefined;
}

async function redisGet(key: string): Promise<unknown> {
  const response = await fetch(`http://127.0.0.1:${SHIM_PORT}`, {
    method: 'POST',
    body: JSON.stringify(['get', key]),
  });
  const parsed: { result: unknown } = await response.json();
  return parsed.result;
}

async function rentCategory(): Promise<{ id: string }> {
  return firstRow({
    rows: await query<{ id: string }>(`select id from "Category" where name = 'Rent'`),
    what: 'the Rent category',
  });
}

function firstRow<T>({ rows, what }: { rows: T[]; what: string }): T {
  const [row] = rows;
  if (row === undefined) {
    throw new Error(`expected a row for ${what}, got none`);
  }
  return row;
}

function preview(text: string, max = 160): string {
  return text.replace(/\n/g, ' | ').slice(0, max);
}

function textOf(frames: Frame[]): string {
  return frames
    .filter((f) => f.type === 'delta')
    .map((f) => f.value || '')
    .join('');
}

async function insertVerifiedUser({
  username,
  email,
  passwordHash,
}: {
  username: string;
  email: string;
  passwordHash: string;
}): Promise<{ id: string }> {
  return firstRow({
    rows: await query<{ id: string }>(
      `with household as (insert into "Household" (id) values (gen_random_uuid()) returning id)
       insert into "User" (id, username, email, password, verified, "householdId", "householdRole")
       select gen_random_uuid(), $1, $2, $3, true, household.id, 'OWNER' from household
       returning id`,
      [username, email, passwordHash],
    ),
    what: `the user ${email}`,
  });
}

/** A member and the household whose rows the harness writes directly. */
type Owner = { id: string; householdId: string };

// Runs against a user of its own: logout deletes the session key, which would
// invalidate the token the other checks share.
async function authLifecycleFlow(): Promise<void> {
  const email = 'login-flow@e2e.test';
  const password = 'e2e-login-password';
  const user = await insertVerifiedUser({
    username: 'e2e-login-flow',
    email,
    passwordHash: await hash(password, 10),
  });

  const login = await api<{ success?: boolean; token?: string }>('POST', '/api/auth/login', {
    body: { email, password },
  });
  const loginBody = login.body ?? {};
  const token = loginBody.token || '';
  const setCookie = login.headers.get('set-cookie') || '';
  check(
    'auth: login succeeds and sets the session cookie',
    login.status === 200 && loginBody.success === true && setCookie.includes('session='),
    `status ${login.status}`,
  );

  const sessionKey = `${redisKeyPrefix('branch')}session:${user.id}:${token}`;
  check('auth: login stores the redis session key', (await redisGet(sessionKey)) !== null);

  const cookie = `session=${token}`;
  const me = await api<{ email?: string }>('GET', '/api/auth/me', { cookie });
  const meBody = me.body ?? {};
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
  check('auth: me after logout is rejected', meAfter.status === 401, `status ${meAfter.status}`);
}

// Runs the session sweep against the Redis REST API, which a unit test's
// in-memory store cannot stand in for.
async function passwordChangeFlow(): Promise<void> {
  const email = 'password-change@e2e.test';
  const password = 'e2e-old-password';
  const newPassword = 'e2e-new-password';
  await query(
    `insert into "User" (id, username, email, password, verified)
     values (gen_random_uuid(), 'e2e-password-change', $1, $2, true)`,
    [email, await hash(password, 10)],
  );
  const logIn = async (withPassword: string) =>
    (
      await api<{ token?: string }>('POST', '/api/auth/login', {
        body: { email, password: withPassword },
      })
    ).body?.token ?? '';
  const thisDevice = await logIn(password);
  const otherDevice = await logIn(password);

  const changed = await api('PUT', '/api/auth/password', {
    token: thisDevice,
    body: { currentPassword: password, newPassword },
  });
  const freshToken = /session=([^;]+)/.exec(changed.headers.get('set-cookie') || '')?.[1] ?? '';
  check('auth: change password succeeds', changed.status === 200, `status ${changed.status}`);

  const otherAfter = await api('GET', '/api/auth/me', { token: otherDevice });
  check(
    'auth: change password ends the user’s other sessions',
    otherAfter.status === 401,
    `status ${otherAfter.status}`,
  );
  const freshAfter = await api('GET', '/api/auth/me', { token: freshToken });
  check(
    'auth: change password keeps the caller signed in on a fresh session',
    freshAfter.status === 200,
    `status ${freshAfter.status}`,
  );
  check('auth: the new password logs in', (await logIn(newPassword)) !== '');
}

async function transactionLifecycleFlow(token: string): Promise<void> {
  const category = firstRow({
    rows: await query<{ id: string }>(`select id from "Category" where name = 'Groceries'`),
    what: 'the Groceries category',
  });

  const created = await api<{ id?: string }>('POST', '/api/transactions', {
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
  const txId = created.body?.id || '';
  check(
    'transactions: POST creates and returns an id',
    created.status === 201 && txId.length > 0,
    `status ${created.status}`,
  );

  const listPath = '/api/transactions?limit=10&startDate=2026-08-01&endDate=2026-08-03';
  type TransactionList = { items?: { id: string }[] };
  const listItems = (result: ApiResult<TransactionList>) => result.body?.items ?? [];
  const inList = (result: ApiResult<TransactionList>) =>
    listItems(result).some((t) => t.id === txId);

  const list = await api<TransactionList>('GET', listPath, { token });
  check(
    'transactions: created transaction appears in the list',
    list.status === 200 && inList(list),
    `status ${list.status}`,
  );

  const summary = await api<{ totalExpense?: number; count?: number }>(
    'GET',
    '/api/transactions/summary?startDate=2026-08-01&endDate=2026-08-03',
    { token },
  );
  const summaryBody = summary.body;
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

  // Upper-cased to prove the search is case-insensitive; the totals must narrow
  // with the paged list or the header describes rows the list never shows.
  const searchQuery = 'searchTerm=LIFECYCLE&startDate=2026-08-01&endDate=2026-08-03';
  const searchedList = await api<TransactionList>(
    'GET',
    `/api/transactions?limit=10&${searchQuery}`,
    { token },
  );
  const searchedSummary = await api<{ count?: number }>(
    'GET',
    `/api/transactions/summary?${searchQuery}`,
    { token },
  );
  const searchedCount = searchedSummary.body?.count;
  check(
    'transactions: search narrows the list and the summary alike',
    listItems(searchedList).length === searchedCount && inList(searchedList),
    `list ${listItems(searchedList).length} vs count ${searchedCount}`,
  );

  const pended = await api('PATCH', `/api/transactions/${txId}/status`, {
    token,
    body: { status: 'PENDING_APPROVAL' },
  });
  const listPending = await api<TransactionList>('GET', listPath, { token });
  check(
    'transactions: PENDING_APPROVAL hides it from the approved list',
    pended.status === 200 && !inList(listPending),
    `status ${pended.status}`,
  );

  const approved = await api('PATCH', `/api/transactions/${txId}/status`, {
    token,
    body: { status: 'APPROVED' },
  });
  const listApproved = await api<TransactionList>('GET', listPath, { token });
  check(
    'transactions: re-approval returns it to the list',
    approved.status === 200 && inList(listApproved),
    `status ${approved.status}`,
  );

  const deleted = await api('DELETE', `/api/transactions/${txId}`, { token });
  const listAfterDelete = await api<TransactionList>('GET', listPath, { token });
  check(
    'transactions: DELETE removes it',
    deleted.status === 200 && !inList(listAfterDelete),
    `status ${deleted.status}`,
  );

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

async function transactionCategoryBreakdownFlow(token: string): Promise<void> {
  const categoryIds = await query<{ id: string; name: string }>(
    `select id, name from "Category" where name in ('Groceries', 'Rent')`,
  );
  const idOf = (name: string) => categoryIds.find((category) => category.name === name)?.id;
  // A window no seeded row or other flow writes into, so the shares are exact.
  const rows = [
    {
      description: 'E2E breakdown rent',
      value: 300,
      category: 'Rent',
      type: 'EXPENSE',
    },
    {
      description: 'E2E breakdown market',
      value: 100,
      category: 'Groceries',
      type: 'EXPENSE',
    },
    {
      description: 'E2E breakdown refund',
      value: 1000,
      category: 'Groceries',
      type: 'INCOME',
    },
  ];
  const createdIds: string[] = [];
  for (const row of rows) {
    const created = await api<{ id?: string }>('POST', '/api/transactions', {
      token,
      body: {
        description: row.description,
        value: row.value,
        type: row.type,
        categoryId: idOf(row.category),
        date: '2026-08-11T12:00:00.000Z',
      },
    });
    createdIds.push(created.body?.id ?? '');
  }

  const window = 'startDate=2026-08-10&endDate=2026-08-12';
  type Slice = { categoryName: string; amount: number; percentage: number };
  const slicesOf = (result: ApiResult<Slice[]>) =>
    (result.body ?? []).map(
      ({ categoryName, amount, percentage }) => `${categoryName}:${amount}:${percentage}`,
    );

  const expenses = await api<Slice[]>(
    'GET',
    `/api/transactions/summary/categories?type=EXPENSE&${window}`,
    { token },
  );
  check(
    'breakdown: expense slices are per category, largest first, with shares',
    expenses.status === 200 && slicesOf(expenses).join() === 'Rent:300:75,Groceries:100:25',
    `status ${expenses.status} ${slicesOf(expenses).join()}`,
  );

  const searched = await api<Slice[]>(
    'GET',
    `/api/transactions/summary/categories?type=EXPENSE&searchTerm=MARKET&${window}`,
    { token },
  );
  check(
    'breakdown: search narrows the slices like it narrows the list',
    slicesOf(searched).join() === 'Groceries:100:100',
    slicesOf(searched).join(),
  );

  const income = await api<Slice[]>(
    'GET',
    `/api/transactions/summary/categories?type=INCOME&${window}`,
    { token },
  );
  check(
    'breakdown: the income split excludes expenses',
    slicesOf(income).join() === 'Groceries:1000:100',
    slicesOf(income).join(),
  );

  const anonymous = await api('GET', `/api/transactions/summary/categories?type=EXPENSE&${window}`);
  check('breakdown: no session is 401', anonymous.status === 401, `status ${anonymous.status}`);

  for (const id of createdIds.filter(Boolean)) {
    await api('DELETE', `/api/transactions/${id}`, { token });
  }
}

const SORT_ORDERS = [
  { sortBy: 'date', sortOrder: 'desc', orderSql: 't.date desc, t.id desc' },
  { sortBy: 'date', sortOrder: 'asc', orderSql: 't.date asc, t.id asc' },
  {
    sortBy: 'amount',
    sortOrder: 'desc',
    orderSql: 't.value desc, t.date desc, t.id desc',
  },
  {
    sortBy: 'amount',
    sortOrder: 'asc',
    orderSql: 't.value asc, t.date desc, t.id desc',
  },
  {
    sortBy: 'category',
    sortOrder: 'asc',
    orderSql: 'c.name asc, t.date desc, t.id desc',
  },
  {
    sortBy: 'category',
    sortOrder: 'desc',
    orderSql: 'c.name desc, t.date desc, t.id desc',
  },
];

const MAX_PAGE_REQUESTS = 50;

type PageWalk = { ids: string[] } | { failure: string };

async function walkTransactionPages(token: string, sortParams: string): Promise<PageWalk> {
  const seen: string[] = [];
  let cursor: string | undefined;

  for (let request = 0; request < MAX_PAGE_REQUESTS; request++) {
    const path = `/api/transactions?limit=3&${sortParams}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const page = await api<{ items: { id: string }[]; nextCursor: string | null }>('GET', path, {
      token,
    });
    const body = page.body;
    if (page.status !== 200 || !body) {
      return { failure: `page ${request + 1} returned status ${page.status}` };
    }
    seen.push(...body.items.map((item) => item.id));
    if (!body.nextCursor) {
      return { ids: seen };
    }
    cursor = body.nextCursor;
  }
  return {
    failure: `still paging after ${MAX_PAGE_REQUESTS} requests; raise MAX_PAGE_REQUESTS`,
  };
}

// Small pages force many cursor hops, so a keyset that skips or repeats a
// row on a tie (same amount, same category) shows up as a wrong sequence.
async function transactionCursorPagingFlow(token: string, owner: Owner): Promise<void> {
  const tiedDescription = 'E2E sort tie';
  await query(
    `insert into "Transaction"
       (id, description, value, "originalAmount", type, "categoryId", "householdId", "userId", date)
     select gen_random_uuid(), $1, tie.value, tie.value, 'EXPENSE', c.id, $2, $3, tie.date
     from (values
       (50, 'Rent', timestamp '2026-03-01'), (50, 'Rent', timestamp '2026-03-01'),
       (50, 'Groceries', timestamp '2026-03-01'), (20, 'Groceries', timestamp '2026-03-02'),
       (20, 'Groceries', timestamp '2026-03-02'), (50, 'Rent', timestamp '2026-03-03'),
       (80, 'Groceries', timestamp '2026-03-01')
     ) as tie(value, category, date)
     join "Category" c on c.name = tie.category`,
    [tiedDescription, owner.householdId, owner.id],
  );

  try {
    for (const { sortBy, sortOrder, orderSql } of SORT_ORDERS) {
      const walk = await walkTransactionPages(token, `sortBy=${sortBy}&sortOrder=${sortOrder}`);
      const expected = await query<{ id: string }>(
        `select t.id from "Transaction" t join "Category" c on c.id = t."categoryId"
         where t.status = 'APPROVED' and t."householdId" = $1
         order by ${orderSql}`,
        [owner.householdId],
      );
      const expectedIds = expected.map((row) => row.id);
      const label = `transactions: cursor paging by ${sortBy} ${sortOrder} returns every row once, in order`;
      if ('failure' in walk) {
        check(label, false, walk.failure);
        continue;
      }
      check(
        label,
        walk.ids.length === expectedIds.length &&
          walk.ids.every((id, index) => id === expectedIds[index]),
        `walked ${walk.ids.length}, unique ${new Set(walk.ids).size}, expected ${expectedIds.length}`,
      );
    }
  } finally {
    await query(`delete from "Transaction" where description = $1 and "householdId" = $2`, [
      tiedDescription,
      owner.householdId,
    ]);
  }

  const badSort = await api('GET', '/api/transactions?sortBy=description', {
    token,
  });
  check(
    'transactions: an unknown sort field is rejected',
    badSort.status === 400,
    `status ${badSort.status}`,
  );
}

async function scheduledCronFlow(owner: Owner): Promise<void> {
  const category = await rentCategory();
  const description = 'E2E due schedule';
  const schedule = firstRow({
    rows: await query<{ id: string }>(
      `insert into "ScheduledTransaction"
       (id, description, value, type, "categoryId", "scheduleType", "householdId", "userId", "nextRunDate")
     values (gen_random_uuid(), $1, 55, 'EXPENSE', $2, 'DAILY', $3, $4, now() - interval '1 day')
     returning id`,
      [description, category.id, owner.householdId, owner.id],
    ),
    what: 'the due schedule',
  });

  const unauthed = await api('GET', '/api/scheduled-transactions/process');
  check(
    'cron: process without the secret is rejected',
    unauthed.status === 401,
    `status ${unauthed.status}`,
  );

  const run = await api('GET', '/api/scheduled-transactions/process', {
    token: process.env.CRON_SECRET || 'e2e',
  });
  check('cron: process with CRON_SECRET succeeds', run.status === 200, `status ${run.status}`);

  const transactionRows = await query<{ status: string; userId: string | null }>(
    `select status, "userId" from "Transaction" where "householdId" = $1 and description = $2`,
    [owner.householdId, description],
  );
  const [firstTransaction] = transactionRows;
  check(
    'cron: due schedule created a PENDING_APPROVAL transaction',
    transactionRows.length === 1 && firstTransaction?.status === 'PENDING_APPROVAL',
    firstTransaction
      ? `${transactionRows.length} row(s), status ${firstTransaction.status}`
      : 'no transaction created',
  );

  check(
    "cron: the projected transaction is the cron's write, in the schedule's household",
    transactionRows.length === 1 && firstTransaction?.userId === null,
    `userId ${firstTransaction?.userId}`,
  );

  const [after] = await query<{ future: boolean }>(
    `select "nextRunDate" > now() as future from "ScheduledTransaction" where id = $1`,
    [schedule.id],
  );
  check('cron: nextRunDate advanced into the future', after?.future === true);
}

async function stuckImportSweepFlow(owner: Owner): Promise<void> {
  const insertImport = async (status: string, ageHours: number) => {
    const row = firstRow({
      rows: await query<{ id: string }>(
        `insert into "Import"
         (id, "householdId", "userId", "fileUrl", "originalFileName", status, "createdAt", "updatedAt")
       values (gen_random_uuid(), $1, $2, 'e2e/stuck.xlsx', 'stuck.xlsx', $3::"ImportStatus",
               now() - make_interval(hours => $4), now())
       returning id`,
        [owner.householdId, owner.id, status, ageHours],
      ),
      what: `a ${status} import`,
    });
    return row.id;
  };
  const stuckId = await insertImport('PROCESSING', 7);
  const freshId = await insertImport('PROCESSING', 5);
  const completedId = await insertImport('COMPLETED', 7);

  const unauthed = await api('GET', '/api/imports/fail-stuck');
  check(
    'cron: fail-stuck without the secret is rejected',
    unauthed.status === 401,
    `status ${unauthed.status}`,
  );

  const run = await api('GET', '/api/imports/fail-stuck', {
    token: process.env.CRON_SECRET || 'e2e',
  });
  check('cron: fail-stuck with CRON_SECRET succeeds', run.status === 200, `status ${run.status}`);

  const rows = await query<{
    id: string;
    status: string;
    claimed: boolean;
    error: string | null;
  }>(
    `select id, status, "extractionCompletedAt" is not null as claimed, error
       from "Import" where id = any($1::uuid[])`,
    [[stuckId, freshId, completedId]],
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  const stuck = byId.get(stuckId);
  check(
    'cron: an import PROCESSING past the token expiry is FAILED and claimed',
    stuck?.status === 'FAILED' && stuck.claimed && !!stuck.error,
    JSON.stringify(stuck),
  );
  check(
    'cron: an import PROCESSING within the token expiry is left alone',
    byId.get(freshId)?.status === 'PROCESSING',
    `status ${byId.get(freshId)?.status}`,
  );
  check(
    'cron: an old COMPLETED import is left alone',
    byId.get(completedId)?.status === 'COMPLETED',
    `status ${byId.get(completedId)?.status}`,
  );

  await query('delete from "Import" where id = any($1::uuid[])', [[stuckId, freshId, completedId]]);
}

// The dev server runs without TELEGRAM_WEBHOOK_SECRET, so only the fail-closed
// path is covered here.
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

  const badJson = await api<{ error?: string }>('POST', '/api/excel-extraction-agent/webhook', {
    rawBody: '{not json',
  });
  check(
    'excel webhook: malformed JSON body gets 400',
    badJson.status === 400 && badJson.body?.error === 'Invalid JSON body',
    `status ${badJson.status}`,
  );

  const secret = process.env.EXCEL_EXTRACTION_AGENT_WEBHOOK_SECRET;
  const timestamp = Date.now();
  if (secret) {
    // A valid HMAC must pass auth and reach processing (404 = unknown request).
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

type ImportRecord = {
  id: string;
  status: ImportStatus;
  creditCardLastFourDigits: string | null;
  mergedIntoImportId?: string | null;
};

function randomCardDigits(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

async function findImport(token: string, importId: string): Promise<ImportRecord | undefined> {
  const listed = await api<ImportRecord[]>('GET', '/api/imports', { token });
  const imports = Array.isArray(listed.body) ? listed.body : [];
  return imports.find((record) => record.id === importId);
}

async function waitForImportCompletion(
  token: string,
  importId: string,
  timeoutMs = 30_000,
): Promise<ImportRecord | undefined> {
  const deadline = Date.now() + timeoutMs;
  let found: ImportRecord | undefined;
  while (Date.now() < deadline) {
    found = await findImport(token, importId);
    const settled = found && !ACTIVE_IMPORT_STATUSES.includes(found.status);
    if (settled) {
      return found;
    }
    await sleep(500);
  }
  return found;
}

async function apiTokenFlow(sessionToken: string, otherUserSessionToken: string): Promise<string> {
  const unscoped = await api('POST', '/api/api-tokens', {
    token: sessionToken,
    body: { name: 'no scopes', scopes: [] },
  });
  check(
    'API tokens: a token needs at least one scope',
    unscoped.status === 400,
    `status ${unscoped.status}`,
  );

  const created = await api<{ id?: string; token?: string }>('POST', '/api/api-tokens', {
    token: sessionToken,
    body: { name: 'e2e statements script', scopes: ['IMPORTS'] },
  });
  const { id, token } = created.body ?? {};
  check(
    'API tokens: a session creates one and sees its plaintext once',
    created.status === 201 && Boolean(token?.startsWith('mxk_')),
    `status ${created.status}`,
  );
  if (!id || !token) {
    return '';
  }

  const [stored] = await query<{ tokenHash: string }>(
    'select "tokenHash" from "ApiToken" where id = $1',
    [id],
  );
  check(
    'API tokens: only a hash is stored',
    stored !== undefined && stored.tokenHash !== token && !stored.tokenHash.includes(token),
  );

  const listed = await api('GET', '/api/api-tokens', {
    token: sessionToken,
  });
  check(
    'API tokens: the list never carries the token',
    listed.status === 200 && !JSON.stringify(listed.body).includes(token),
    `status ${listed.status}`,
  );

  const forged = await api('GET', '/api/imports', {
    token: `mxk_${'A'.repeat(43)}${'B'.repeat(16)}`,
  });
  check(
    'API tokens: a forged token is refused',
    forged.status === 401 && errorCode(forged) === 'INVALID_API_TOKEN',
    `status ${forged.status}`,
  );

  const outsideImports = await api('GET', '/api/transactions', { token });
  check(
    'API tokens: refused outside the import routes',
    outsideImports.status === 401 && errorCode(outsideImports) === 'API_TOKEN_NOT_ACCEPTED',
    `status ${outsideImports.status}`,
  );

  const deletesImport = await api('DELETE', `/api/imports/${crypto.randomUUID()}`, { token });
  check(
    'API tokens: refused on an import route the script does not drive',
    deletesImport.status === 401 && errorCode(deletesImport) === 'API_TOKEN_NOT_ACCEPTED',
    `status ${deletesImport.status}`,
  );

  const mintsAnother = await api('POST', '/api/api-tokens', {
    token,
    body: { name: 'minted by a token' },
  });
  check(
    'API tokens: a token cannot mint another',
    mintsAnother.status === 401,
    `status ${mintsAnother.status}`,
  );

  const otherUserRevoke = await api('DELETE', `/api/api-tokens/${id}`, {
    token: otherUserSessionToken,
  });
  check(
    "API tokens: another user cannot revoke one's token",
    otherUserRevoke.status === 404,
    `status ${otherUserRevoke.status}`,
  );

  return token;
}

async function apiTokenRevocationFlow(sessionToken: string, apiToken: string): Promise<void> {
  const listed = await api<{ id: string; lastUsedAt: string | null }[]>('GET', '/api/api-tokens', {
    token: sessionToken,
  });
  const tokens = listed.body ?? [];
  const [used] = tokens;
  check(
    'API tokens: use is recorded',
    tokens.length === 1 && used !== undefined && used.lastUsedAt !== null,
    `${tokens.length} tokens, lastUsedAt ${used?.lastUsedAt}`,
  );
  if (!used) {
    return;
  }

  const revoked = await api('DELETE', `/api/api-tokens/${used.id}`, {
    token: sessionToken,
  });
  const afterRevoke = await api('GET', '/api/imports', { token: apiToken });
  check(
    'API tokens: a revoked token stops working',
    revoked.status === 200 &&
      afterRevoke.status === 401 &&
      errorCode(afterRevoke) === 'INVALID_API_TOKEN',
    `revoke ${revoked.status}, then ${afterRevoke.status}`,
  );
}

// The raw column read proves the value was encrypted, not stored as plaintext.
async function importEncryptionFlow(token: string): Promise<void> {
  const digits = randomCardDigits();
  const originalFileName = `card-${digits}_03_2026.csv`;

  // The server rejects any URL outside its own bucket, so a harness missing
  // these would submit `https://undefined.s3.undefined…` and read as a server
  // bug rather than as its own environment.
  const bucket = process.env.IMPORTS_S3_BUCKET;
  const region = process.env.IMPORTS_S3_REGION;
  if (!bucket || !region) {
    check(
      'imports: harness carries the bucket env the upload URL is built from',
      false,
      'set IMPORTS_S3_BUCKET and IMPORTS_S3_REGION for this harness process',
    );
    return;
  }

  const fileUrl = `https://${bucket}.s3.${region}.amazonaws.com/${buildImportObjectKey(originalFileName, crypto.randomUUID())}`;

  const created = await api<{ id?: string }>('POST', '/api/imports/process', {
    token,
    body: { fileUrl, originalFileName },
  });
  const importId = created.body?.id;
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

  await query('update "Import" set "creditCardLastFourDigits" = $1 where id = $2', [
    CIPHERTEXT_FROM_AN_EARLIER_CLIENT,
    importId,
  ]);
  const withOlderCiphertext = await findImport(token, importId);
  check(
    'imports: a column encrypted by an earlier client still decrypts',
    withOlderCiphertext?.creditCardLastFourDigits === DIGITS_BEHIND_THAT_CIPHERTEXT,
    `read ${withOlderCiphertext?.creditCardLastFourDigits}, expected ${DIGITS_BEHIND_THAT_CIPHERTEXT}`,
  );
}

async function importMergeFlow(token: string): Promise<void> {
  const bucket = process.env.IMPORTS_S3_BUCKET;
  const region = process.env.IMPORTS_S3_REGION;
  if (!bucket || !region) {
    return;
  }
  const digits = randomCardDigits();
  const originalFileName = `card-${digits}_04_2026.csv`;
  // An import key from before keys dropped the file name still has to be accepted.
  const body = {
    fileUrl: `https://${bucket}.s3.${region}.amazonaws.com/imports/${originalFileName}`,
    originalFileName,
  };

  const first = await api<{ id?: string }>('POST', '/api/imports/process', { token, body });
  const firstId = first.body?.id;
  if (!firstId) {
    check('imports: merge flow could submit the first import', false, '');
    return;
  }
  await waitForImportCompletion(token, firstId);

  const second = await api<{ id?: string }>('POST', '/api/imports/process', { token, body });
  const secondId = second.body?.id;
  if (!secondId) {
    check('imports: merge flow could submit the second import', false, '');
    return;
  }
  const merged = await waitForImportCompletion(token, secondId);
  check(
    'imports: a duplicate upload is kept as MERGED, pointing at the older import',
    merged?.status === 'MERGED' && merged.mergedIntoImportId === firstId,
    `status ${merged?.status ?? 'never listed'}, mergedInto ${merged?.mergedIntoImportId ?? 'null'}`,
  );

  const survivor = await waitForImportCompletion(token, firstId);
  check(
    'imports: the survivor is COMPLETED again once the moved rows are matched',
    survivor?.status === 'COMPLETED',
    `status ${survivor?.status ?? 'never listed'}`,
  );

  const byId = await api<ImportRecord>('GET', `/api/imports/${secondId}`, { token });
  const byIdRecord = byId.body;
  check(
    'imports: GET by id returns the merged import with its pointer',
    byId.status === 200 && byIdRecord?.mergedIntoImportId === firstId,
    `status ${byId.status}, mergedInto ${byIdRecord?.mergedIntoImportId ?? 'null'}`,
  );

  const [rows] = await query<{ count: number }>(
    'select count(*)::int as count from "ImportedTransaction" where "importId" = $1',
    [firstId],
  );
  check(
    'imports: the duplicate row was not carried into the survivor',
    rows?.count === 1,
    `survivor holds ${rows?.count ?? 'unknown'} row(s), expected 1`,
  );
}

// The mock extractor returns one `Coffee <digits>` row for 12.50 on 7 Mar 2026,
// so a placeholder of 40 is far outside the value window.
async function variableAmountPlaceholderFlow(
  sessionToken: string,
  apiToken: string,
  owner: Owner,
): Promise<void> {
  const bucket = process.env.IMPORTS_S3_BUCKET;
  const region = process.env.IMPORTS_S3_REGION;
  if (!bucket || !region) {
    return;
  }
  const digits = randomCardDigits();
  const description = `E2E variable ${digits}`;
  const category = await rentCategory();

  // Created without a prefix and given one after the cron has run, so the
  // check proves an edit reaches a pending transaction already projected.
  const schedule = {
    description,
    value: 40,
    type: 'EXPENSE',
    categoryId: category.id,
    scheduleType: 'DAILY',
  };
  const created = await api<string>('POST', '/api/scheduled-transactions', {
    token: sessionToken,
    body: schedule,
  });
  const scheduleId = created.body;
  if (created.status !== 201 || !scheduleId) {
    check('variable amount: the schedule was created', false, '');
    return;
  }
  await query(
    `update "ScheduledTransaction" set "nextRunDate" = now() - interval '1 day' where id = $1`,
    [scheduleId],
  );
  await api('GET', '/api/scheduled-transactions/process', {
    token: process.env.CRON_SECRET || 'e2e',
  });

  const [placeholder] = await query<{
    id: string;
    scheduledTransactionId: string | null;
  }>(
    `select id, "scheduledTransactionId" from "Transaction" where "householdId" = $1 and description = $2`,
    [owner.householdId, description],
  );
  check(
    'variable amount: the cron links the pending transaction to its schedule',
    placeholder?.scheduledTransactionId === scheduleId,
    `linked to ${placeholder?.scheduledTransactionId ?? 'no transaction'}`,
  );
  if (!placeholder) {
    return;
  }

  const updated = await api('PUT', `/api/scheduled-transactions/${scheduleId}`, {
    token: sessionToken,
    body: { ...schedule, bankDescriptionPrefix: `coffee ${digits}` },
  });
  check(
    'variable amount: a schedule saves with a bank description prefix',
    updated.status === 200,
    `status ${updated.status}`,
  );
  await query(`update "Transaction" set date = '2026-03-08' where id = $1`, [placeholder.id]);

  const originalFileName = `card-${digits}_05_2026.csv`;
  const submitted = await api<{ id?: string }>('POST', '/api/imports/process', {
    token: apiToken,
    body: {
      fileUrl: `https://${bucket}.s3.${region}.amazonaws.com/imports/${originalFileName}`,
      originalFileName,
    },
  });
  const importId = submitted.body?.id;
  if (!importId) {
    check('variable amount: the import was submitted', false, '');
    return;
  }
  await waitForImportCompletion(apiToken, importId);

  const preview = await api<
    {
      action: string;
      value: number;
      match: { transactionId: string; approvesPendingTransaction: boolean } | null;
    }[]
  >('GET', `/api/imports/${importId}/reconciliation-preview`, { token: apiToken });
  const [item] = Array.isArray(preview.body) ? preview.body : [];
  check(
    'variable amount: a 12.50 charge merges into the 40 placeholder its prefix names',
    item?.action === 'MERGE' &&
      item.match?.transactionId === placeholder.id &&
      item.match.approvesPendingTransaction,
    `action ${item?.action ?? 'none'}, merges into ${item?.match?.transactionId ?? 'nothing'}`,
  );
}

type ForeignRows = {
  transactionId: string;
  importId: string;
  importedTransactionId: string;
  scheduleId: string;
  mappingId: string;
  ruleId: string;
  subscriptionId: string;
};

// One row of every household-owned model, written straight into the other
// household so no route of the household under test ever touched them.
async function insertForeignRows(owner: Owner): Promise<ForeignRows> {
  const rent = await rentCategory();
  const insertOne = async (sql: string, params: unknown[], what: string) =>
    firstRow({ rows: await query<{ id: string }>(sql, params), what }).id;
  const values = [owner.householdId, owner.id];

  const transactionId = await insertOne(
    `select id from "Transaction" where "householdId" = $1 order by date limit 1`,
    [owner.householdId],
    "the other household's transaction",
  );
  const importId = await insertOne(
    `insert into "Import" (id, "householdId", "userId", "fileUrl", "originalFileName", status, "updatedAt")
     values (gen_random_uuid(), $1, $2, 'e2e/leak.xlsx', 'leak.xlsx', 'COMPLETED', now()) returning id`,
    values,
    "the other household's import",
  );
  const importedTransactionId = await insertOne(
    `insert into "ImportedTransaction"
       (id, "householdId", "userId", "importId", description, value, currency, "originalAmount", date, type, "rawData")
     values (gen_random_uuid(), $1, $2, $3, 'LEAK GUARD ROW', 31, 'ILS', 31, now(), 'EXPENSE', '{}') returning id`,
    [...values, importId],
    "the other household's imported row",
  );
  const scheduleId = await insertOne(
    `insert into "ScheduledTransaction"
       (id, "householdId", "userId", description, value, type, "categoryId", "scheduleType", "nextRunDate")
     values (gen_random_uuid(), $1, $2, 'LEAK GUARD SCHEDULE', 32, 'EXPENSE', $3, 'MONTHLY', now() + interval '10 days')
     returning id`,
    [...values, rent.id],
    "the other household's schedule",
  );
  const mappingId = await insertOne(
    `insert into "UserCategoryMapping" (id, "householdId", "userId", "descriptionPattern", "categoryId", "updatedAt")
     values (gen_random_uuid(), $1, $2, 'leak guard merchant', $3, now()) returning id`,
    [...values, rent.id],
    "the other household's category mapping",
  );
  const ruleId = await insertOne(
    `insert into "AutoApproveRule" (id, "householdId", "userId", "descriptionPattern", "categoryId", type, "updatedAt")
     values (gen_random_uuid(), $1, $2, 'LEAK GUARD', $3, 'EXPENSE', now()) returning id`,
    [...values, rent.id],
    "the other household's auto-approve rule",
  );
  const subscriptionId = await insertOne(
    `insert into "DetectedSubscription"
       (id, "householdId", "userId", "merchantName", "displayName", "averageAmount", frequency,
        "lastChargeDate", "nextExpectedDate", "annualCost", "matchingDescriptions", "updatedAt")
     values (gen_random_uuid(), $1, $2, 'LEAKGUARD', 'Leak Guard', 33, 'MONTHLY', now(),
             now() + interval '20 days', 396, '{LEAK GUARD}', now()) returning id`,
    values,
    "the other household's subscription",
  );
  return {
    transactionId,
    importId,
    importedTransactionId,
    scheduleId,
    mappingId,
    ruleId,
    subscriptionId,
  };
}

// Every row of the other household, as one comparable string: a write that
// crossed households changes it, whatever status the route answered with.
async function snapshotHousehold(householdId: string): Promise<string> {
  const tables = Object.entries(IS_HOUSEHOLD_OWNED)
    .filter(([, isOwned]) => isOwned)
    .map(([model]) => model);
  const snapshots = await Promise.all(
    tables.map(async (table) => {
      const rows = await query(
        `select to_jsonb(t) - 'updatedAt' as row from "${table}" t where "householdId" = $1 order by id`,
        [householdId],
      );
      return `${table}:${JSON.stringify(rows)}`;
    }),
  );
  return snapshots.join('\n');
}

/**
 * The leak guard: a member of one household aims every household route at the
 * other household's ids. Each must answer as if the row did not exist — a 404,
 * or a list without it — and leave every row of the other household as it was.
 */
async function householdLeakGuardFlow(attacker: { token: string }, victim: Owner): Promise<void> {
  const foreign = await insertForeignRows(victim);
  const before = await snapshotHousehold(victim.householdId);
  const token = attacker.token;
  const rent = await rentCategory();
  const transactionBody = {
    description: 'hijack',
    value: 1,
    type: 'EXPENSE',
    categoryId: rent.id,
    date: '2026-01-01',
  };
  const importedRowBody = {
    description: 'hijack',
    value: 1,
    date: '2026-01-01',
    type: 'EXPENSE',
    categoryId: rent.id,
  };
  const scheduleBody = {
    description: 'hijack',
    value: 1,
    type: 'EXPENSE',
    categoryId: rent.id,
    scheduleType: 'MONTHLY',
    dayOfMonth: 1,
  };

  const writes: [string, string, unknown?][] = [
    ['PUT', `/api/transactions/${foreign.transactionId}`, transactionBody],
    ['PATCH', `/api/transactions/${foreign.transactionId}/status`, { status: 'PENDING_APPROVAL' }],
    ['DELETE', `/api/transactions/${foreign.transactionId}`],
    [
      'POST',
      `/api/transactions/${foreign.transactionId}/attachments/presign-upload`,
      { fileName: 'a.pdf', mimeType: 'application/pdf', fileSize: 10 },
    ],
    ['DELETE', `/api/imports/${foreign.importId}`],
    ['POST', `/api/imports/${foreign.importId}/rematch`],
    ['POST', `/api/imports/${foreign.importId}/apply-auto-approve-rules`],
    ['POST', `/api/imports/transactions/${foreign.importedTransactionId}/approve`, importedRowBody],
    ['POST', `/api/imports/transactions/${foreign.importedTransactionId}/merge`, importedRowBody],
    ['POST', `/api/imports/transactions/${foreign.importedTransactionId}/ignore`],
    ['DELETE', `/api/imports/transactions/${foreign.importedTransactionId}`],
    ['POST', '/api/imports/batch-action', { importId: foreign.importId, action: 'approve' }],
    ['POST', '/api/imports/batch-action', { importId: foreign.importId, action: 'ignore' }],
    ['PUT', `/api/scheduled-transactions/${foreign.scheduleId}`, scheduleBody],
    ['DELETE', `/api/scheduled-transactions/${foreign.scheduleId}`],
    ['PUT', `/api/imports/auto-approve-rules/${foreign.ruleId}`, { isActive: false }],
    ['DELETE', `/api/imports/auto-approve-rules/${foreign.ruleId}`],
    ['PATCH', `/api/subscriptions/${foreign.subscriptionId}`, { displayName: 'hijack' }],
    ['PATCH', `/api/subscriptions/${foreign.subscriptionId}/confirm`],
    ['PATCH', `/api/subscriptions/${foreign.subscriptionId}/dismiss`],
    ['POST', `/api/subscriptions/${foreign.subscriptionId}/convert`, { categoryId: rent.id }],
  ];
  for (const [method, path, body] of writes) {
    const result = await api(method, path, { token, body });
    const answeredAsMissing = result.status === 404 || isEmptyBatch(result);
    check(
      `household leak guard: ${method} ${path.replace(/[0-9a-f-]{36}/g, ':id')} finds nothing`,
      answeredAsMissing,
      `status ${result.status} ${preview(JSON.stringify(result.body))}`,
    );
  }

  const reads: [string, (body: unknown) => boolean][] = [
    [`/api/imports/${foreign.importId}`, () => false],
    [`/api/imports/${foreign.importId}/transactions`, isEmptyArray],
    [`/api/imports/${foreign.importId}/reconciliation-preview`, isEmptyArray],
    [`/api/transactions/${foreign.transactionId}/attachments`, () => false],
  ];
  for (const [path, isEmptyAnswer] of reads) {
    const result = await api('GET', path, { token });
    check(
      `household leak guard: GET ${path.replace(/[0-9a-f-]{36}/g, ':id')} shows nothing`,
      result.status === 404 || (result.status === 200 && isEmptyAnswer(result.body)),
      `status ${result.status} ${preview(JSON.stringify(result.body))}`,
    );
  }

  const lists = await Promise.all(
    [
      '/api/transactions?limit=100&startDate=2026-01-01&endDate=2026-12-31',
      '/api/transactions/pending',
      '/api/imports',
      '/api/scheduled-transactions',
      '/api/imports/auto-approve-rules',
      '/api/subscriptions',
      '/api/dashboard',
    ].map(async (path) => ({ path, result: await api('GET', path, { token }) })),
  );
  const foreignIds = Object.values(foreign);
  for (const { path, result } of lists) {
    const text = JSON.stringify(result.body);
    const leakedIds = foreignIds.filter((id) => text.includes(id));
    const leakedMarkers = ['LEAK GUARD', 'Leak Guard', ...USER_B_MARKERS.slice(0, 2)].filter(
      (marker) => text.includes(marker),
    );
    check(
      `household leak guard: GET ${path.split('?')[0]} lists only its own household`,
      result.status === 200 && leakedIds.length === 0 && leakedMarkers.length === 0,
      `status ${result.status}, leaked ${[...leakedIds, ...leakedMarkers].join(', ') || 'nothing'}`,
    );
  }

  const after = await snapshotHousehold(victim.householdId);
  check(
    "household leak guard: the other household's rows are untouched",
    after === before,
    after === before ? 'unchanged' : 'rows changed',
  );

  await householdMembershipLeakGuard({ token, victim });
}

/**
 * The owner-only member and invite routes, aimed at another household's
 * invite and member. Invites and users are not household-owned rows, so the
 * snapshot above does not cover them; this compares them directly.
 */
async function householdMembershipLeakGuard({
  token,
  victim,
}: {
  token: string;
  victim: Owner;
}): Promise<void> {
  const inviteId = firstRow({
    rows: await query<{ id: string }>(
      `insert into "Invite" (id, "householdId", code, role, "createdById", "expiresAt")
       values (gen_random_uuid(), $1, 'LEAKGRD2', 'EDITOR', $2, now() + interval '7 days') returning id`,
      [victim.householdId, victim.id],
    ),
    what: "the other household's invite",
  }).id;
  const memberId = firstRow({
    rows: await query<{ id: string }>(
      `insert into "User" (id, username, email, password, verified, "householdId", "householdRole")
       values (gen_random_uuid(), 'e2e-leak-member', 'leak-member@e2e.test', 'unused', true, $1, 'EDITOR')
       returning id`,
      [victim.householdId],
    ),
    what: "the other household's member",
  }).id;
  const snapshotMembership = async () =>
    JSON.stringify([
      await query(
        `select id, "usedAt", "revokedAt" from "Invite" where "householdId" = $1 order by id`,
        [victim.householdId],
      ),
      await query(
        `select id, "householdRole", "tokenVersion" from "User" where "householdId" = $1 order by id`,
        [victim.householdId],
      ),
    ]);
  const before = await snapshotMembership();

  const writes: [string, string, unknown?][] = [
    ['DELETE', `/api/household/invites/${inviteId}`],
    ['PATCH', `/api/household/members/${memberId}`, { role: 'VIEWER' }],
    ['DELETE', `/api/household/members/${memberId}`],
  ];
  for (const [method, path, body] of writes) {
    const result = await api(method, path, { token, body });
    check(
      `household leak guard: ${method} ${path.replace(/[0-9a-f-]{36}/g, ':id')} finds nothing`,
      result.status === 404,
      `status ${result.status} ${preview(JSON.stringify(result.body))}`,
    );
  }

  const after = await snapshotMembership();
  check(
    "household leak guard: the other household's invites and members are untouched",
    after === before,
    after === before ? 'unchanged' : 'invites or members changed',
  );
}

/**
 * A member's API tokens carry no household, so they would keep acting for an
 * agent set up in the household the member left. Leaving and being removed
 * both revoke them.
 */
async function memberTokenRevocationFlow(): Promise<void> {
  const password = 'e2e-household-password';
  const passwordHash = await hash(password, 10);
  const signIn = async (username: string) => {
    const email = `${username}@e2e.test`;
    const user = await insertVerifiedUser({ username, email, passwordHash });
    const login = await api<{ token?: string }>('POST', '/api/auth/login', {
      body: { email, password },
    });
    return { id: user.id, token: login.body?.token ?? '' };
  };
  const { token: ownerToken } = await signIn('e2e-token-owner');
  const { id: memberId, token: memberToken } = await signIn('e2e-token-member');

  const joinAndMintToken = async (): Promise<string> => {
    const invite = await api<{ code?: string }>('POST', '/api/household/invites', {
      token: ownerToken,
      body: { role: 'EDITOR' },
    });
    const joined = await api('POST', '/api/household/join', {
      token: memberToken,
      body: { code: invite.body?.code ?? '' },
    });
    const minted = await api<{ token?: string }>('POST', '/api/api-tokens', {
      token: memberToken,
      body: { name: 'member script', scopes: ['IMPORTS'] },
    });
    const apiToken = minted.body?.token ?? '';
    const works = await api('GET', '/api/imports', { token: apiToken });
    check(
      "household tokens: a member's API token works while they are in the household",
      invite.status === 201 && joined.status === 200 && works.status === 200,
      `invite ${invite.status}, join ${joined.status}, token use ${works.status}`,
    );
    return apiToken;
  };

  const tokenBeforeLeaving = await joinAndMintToken();
  const left = await api('POST', '/api/household/leave', { token: memberToken });
  const afterLeaving = await api('GET', '/api/imports', { token: tokenBeforeLeaving });
  check(
    "household tokens: leaving revokes the member's API tokens",
    left.status === 200 &&
      afterLeaving.status === 401 &&
      errorCode(afterLeaving) === 'INVALID_API_TOKEN',
    `leave ${left.status}, then ${afterLeaving.status}`,
  );

  const tokenBeforeRemoval = await joinAndMintToken();
  const removed = await api('DELETE', `/api/household/members/${memberId}`, {
    token: ownerToken,
  });
  const afterRemoval = await api('GET', '/api/imports', { token: tokenBeforeRemoval });
  check(
    "household tokens: removal revokes the member's API tokens",
    removed.status === 204 &&
      afterRemoval.status === 401 &&
      errorCode(afterRemoval) === 'INVALID_API_TOKEN',
    `remove ${removed.status}, then ${afterRemoval.status}`,
  );
}

function isEmptyArray(body: unknown): boolean {
  return Array.isArray(body) && body.length === 0;
}

// A batch over an import the caller cannot see finds no rows to act on.
function isEmptyBatch(result: ApiResult): boolean {
  const body = result.body;
  return (
    result.status === 200 &&
    typeof body === 'object' &&
    body !== null &&
    'total' in body &&
    body.total === 0
  );
}

async function main(): Promise<void> {
  const { seeded, stop: shutdown } = await startStack({
    mock: MOCK_PORT,
    shim: SHIM_PORT,
    extraction: EXTRACTION_MOCK_PORT,
  });
  console.log(
    `mock model on ${MOCK_PORT}, upstash shim on ${SHIM_PORT}, extraction agent on ${EXTRACTION_PORT}${EXTRACTION_MOCK_PORT === null ? ' (real service, mock not started)' : ''}`,
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
    warmupError ? `error frame: ${warmupError.message}` : `status ${warmup.status}`,
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

  const { stdout } = await execFileAsync('npx', ['prisma', 'migrate', 'status'], {
    env: process.env,
    timeout: 180_000,
  }).catch((e) => ({ stdout: String(e.stdout || e) }));
  check(
    'prisma reports no drift after mastra schema exists',
    /up to date/i.test(stdout),
    stdout.trim().split('\n').slice(-1)[0],
  );

  const unauth = await streamChat(null, 'How much did I spend?');
  check('unauthenticated request rejected', unauth.status === 401, `status ${unauth.status}`);

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
  const firstDelta = deltas[0];
  const lastDelta = deltas.at(-1);
  const spread = firstDelta && lastDelta ? lastDelta.at - firstDelta.at : 0;
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
  check('tool result contains the TS-computed percentage', toolOutput.includes('26.83%'));
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
    bText.includes('7,777') && bText.includes('8,888') && !bText.includes('4,100'),
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

  const afterAbort = await streamChat(null, 'still alive?').catch(() => null);
  check(
    'app survives an abrupt client disconnect',
    afterAbort?.status === 401,
    afterAbort ? `status ${afterAbort.status}` : 'app unreachable — it crashed',
  );

  await authLifecycleFlow();
  await passwordChangeFlow();
  await transactionLifecycleFlow(seeded.userA.token);
  await transactionCategoryBreakdownFlow(seeded.userA.token);
  await transactionCursorPagingFlow(seeded.userA.token, seeded.userA);
  await scheduledCronFlow(seeded.userA);
  await stuckImportSweepFlow(seeded.userA);
  await telegramWebhookFlow();
  await excelWebhookFlow(seeded.userA.id);
  // The import flows run on an Imports-scoped API token rather than the
  // session, so they prove the routes the statements script drives accept one.
  const apiToken = await apiTokenFlow(seeded.userA.token, seeded.userB.token);
  await importEncryptionFlow(apiToken);
  await importMergeFlow(apiToken);
  await variableAmountPlaceholderFlow(seeded.userA.token, apiToken, seeded.userA);
  await apiTokenRevocationFlow(seeded.userA.token, apiToken);
  await householdLeakGuardFlow(seeded.userA, seeded.userB);
  await memberTokenRevocationFlow();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
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
