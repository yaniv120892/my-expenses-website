import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type {
  Transaction,
  TransactionSummary,
} from '@/shared/types/transaction';

const {
  categoryRepository,
  transactionRepository,
  transactionService,
  scheduledTransactionService,
  reportSwallowedError,
  logger,
} = vi.hoisted(() => ({
  categoryRepository: { getAllCategories: vi.fn() },
  transactionRepository: {
    getTransactions: vi.fn(),
    getTransactionsSummary: vi.fn(),
  },
  transactionService: {
    getTransactionsList: vi.fn(),
    getTransactionItem: vi.fn(),
    createTransaction: vi.fn(),
    updateTransaction: vi.fn(),
    deleteTransaction: vi.fn(),
    getPendingTransactions: vi.fn(),
  },
  scheduledTransactionService: { listScheduledTransactions: vi.fn() },
  reportSwallowedError: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/server/repositories/categoryRepository', () => ({
  default: categoryRepository,
}));
vi.mock('@/server/repositories/transactionRepository', () => ({
  default: transactionRepository,
}));
vi.mock('@/server/services/transactionService', () => ({
  default: transactionService,
}));
vi.mock('@/server/services/scheduledTransactionService', () => ({
  default: scheduledTransactionService,
}));
vi.mock('@/server/logging/reportSwallowedError', () => ({
  reportSwallowedError,
}));
vi.mock('@/server/logging/logger', () => ({ default: logger }));

import { createMcpServer } from '@/server/mcp/createMcpServer';
import { HttpError } from '@/server/http/errors';
import { AGENT_TOOL_GUIDE } from '@/shared/agentTools';

const USER_ID = 'user-1';
const TRANSACTION_ID = '33333333-3333-4333-8333-333333333333';

const CATEGORIES = [
  { id: 'c-food', name: 'Food & Groceries', parentId: null },
  { id: 'c-fast', name: 'Fast Food', parentId: 'c-food' },
  { id: 'c-rent', name: 'Rent', parentId: null },
];

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: TRANSACTION_ID,
    description: 'קפה בארומה',
    value: 18,
    currency: 'ILS',
    originalAmount: 18,
    exchangeRate: null,
    exchangeRateDate: null,
    exchangeRateSource: null,
    date: new Date('2026-10-20T00:00:00Z'),
    type: 'EXPENSE',
    status: 'APPROVED',
    category: { id: 'c-fast', name: 'Fast Food' },
    ...overrides,
  };
}

function totals(overrides: Partial<TransactionSummary> = {}) {
  return {
    totalIncome: 0,
    totalExpense: 100,
    count: 1,
    incomeCount: 0,
    expenseCount: 1,
    ...overrides,
  };
}

// Through a real client, so schema validation, argument defaults and result
// shaping run exactly as they do for a remote agent.
async function connectClient(): Promise<Client> {
  const server = createMcpServer({ userId: USER_ID });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-agent', version: '1.0.0' });
  await Promise.all([
    client.connect(clientTransport),
    server.connect(serverTransport),
  ]);
  return client;
}

type ToolCallOutcome = { text: string; isError: boolean };

async function call({
  client,
  name,
  toolArguments = {},
}: {
  client: Client;
  name: string;
  toolArguments?: Record<string, unknown>;
}): Promise<ToolCallOutcome> {
  const result = await client.callTool({ name, arguments: toolArguments });
  const content = Array.isArray(result.content) ? result.content : [];
  const text = content
    .map((part: { type: string; text?: string }) => part.text ?? '')
    .join('\n');
  return { text, isError: result.isError === true };
}

let client: Client;

beforeEach(async () => {
  vi.clearAllMocks();
  categoryRepository.getAllCategories.mockResolvedValue(CATEGORIES);
  transactionRepository.getTransactionsSummary.mockResolvedValue(totals());
  transactionRepository.getTransactions.mockResolvedValue([transaction()]);
  transactionService.getTransactionItem.mockResolvedValue(transaction());
  transactionService.createTransaction.mockResolvedValue({
    id: TRANSACTION_ID,
    transaction: transaction(),
  });
  transactionService.updateTransaction.mockResolvedValue(transaction());
  client = await connectClient();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('MCP tool surface', () => {
  it('advertises exactly the agent tools', async () => {
    const { tools } = await client.listTools();

    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'add_transaction',
      'compare_periods',
      'delete_transaction',
      'find_transactions',
      'get_spending_trends',
      'list_categories',
      'list_pending_transactions',
      'list_scheduled_transactions',
      'summarize_transactions',
      'update_transaction',
    ]);
  });

  it('briefs the agent on exactly the tools the server registers', async () => {
    const { tools } = await client.listTools();

    expect(AGENT_TOOL_GUIDE.map((tool) => tool.name).sort()).toEqual(
      tools.map((tool) => tool.name).sort(),
    );
  });

  it('takes no user id from the agent on any tool', async () => {
    const { tools } = await client.listTools();

    const userScopedInputs = tools.filter((tool) =>
      Object.keys(tool.inputSchema.properties ?? {}).some((property) =>
        /user/i.test(property),
      ),
    );
    expect(userScopedInputs).toEqual([]);
  });

  it('marks only delete_transaction as destructive', async () => {
    const { tools } = await client.listTools();

    const destructive = tools
      .filter((tool) => tool.annotations?.destructiveHint === true)
      .map((tool) => tool.name);
    expect(destructive).toEqual(['delete_transaction']);
  });
});

describe('read tools', () => {
  it('lists category names', async () => {
    const outcome = await call({ client, name: 'list_categories' });

    expect(outcome.text.split('\n')).toEqual([
      'Food & Groceries',
      'Fast Food',
      'Rent',
    ]);
  });

  it("summarizes the token owner's transactions over a category subtree", async () => {
    transactionRepository.getTransactionsSummary.mockResolvedValue(
      totals({ totalExpense: 1234.5 }),
    );

    const outcome = await call({
      client,
      name: 'summarize_transactions',
      toolArguments: { aggregation: 'total', categoryName: 'groceries' },
    });

    expect(outcome.isError).toBe(false);
    expect(outcome.text).toContain('1,234.50');
    expect(outcome.text).toContain(
      'Category: Food & Groceries (including its subcategories)',
    );
    expect(transactionRepository.getTransactionsSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        categoryIds: ['c-food', 'c-fast'],
      }),
    );
  });

  it('compares two periods with server-side arithmetic', async () => {
    transactionRepository.getTransactionsSummary
      .mockResolvedValueOnce(totals({ totalExpense: 1000 }))
      .mockResolvedValueOnce(totals({ totalExpense: 1500 }));

    const outcome = await call({
      client,
      name: 'compare_periods',
      toolArguments: {
        periodA: {
          label: 'Sep',
          startDate: '2026-09-01',
          endDate: '2026-09-30',
        },
        periodB: {
          label: 'Oct',
          startDate: '2026-10-01',
          endDate: '2026-10-31',
        },
      },
    });

    expect(outcome.text).toContain('Percentage change: +50%');
  });

  it('returns an unknown category as a tool error the agent can fix', async () => {
    const outcome = await call({
      client,
      name: 'summarize_transactions',
      toolArguments: { aggregation: 'total', categoryName: 'Utilities' },
    });

    expect(outcome.isError).toBe(true);
    expect(outcome.text).toContain('Unknown category "Utilities"');
    expect(transactionRepository.getTransactionsSummary).not.toHaveBeenCalled();
  });

  it('finds transactions with their ids, scoped to the token owner', async () => {
    const outcome = await call({
      client,
      name: 'find_transactions',
      toolArguments: { searchTerm: 'קפה', categoryName: 'Food & Groceries' },
    });

    expect(outcome.text).toContain(`id ${TRANSACTION_ID}`);
    expect(outcome.text).toContain('קפה בארומה');
    expect(outcome.text).toContain('Fast Food');
    expect(outcome.text).not.toContain('Note:');
    expect(transactionRepository.getTransactions).toHaveBeenCalledWith({
      userId: USER_ID,
      searchTerm: 'קפה',
      categoryIds: ['c-food', 'c-fast'],
      page: 1,
      perPage: 21,
    });
  });

  it('says when more transactions match than it listed', async () => {
    transactionRepository.getTransactions.mockResolvedValue([
      transaction({ id: '44444444-4444-4444-8444-444444444441' }),
      transaction({ id: '44444444-4444-4444-8444-444444444442' }),
      transaction({ id: '44444444-4444-4444-8444-444444444443' }),
    ]);

    const outcome = await call({
      client,
      name: 'find_transactions',
      toolArguments: { limit: 2 },
    });

    expect(outcome.text).not.toContain('444444444443');
    expect(outcome.text).toContain(
      'Note: these are only the newest 2; more transactions match.',
    );
  });

  it.each([
    ['find_transactions', { startDate: 'last month' }],
    ['summarize_transactions', { aggregation: 'total', endDate: '2026-02-31' }],
    ['get_spending_trends', { period: 'monthly', startDate: '2026-13-01' }],
    [
      'compare_periods',
      {
        periodA: {
          label: 'Feb',
          startDate: '2026-02-01',
          endDate: '2026-02-30',
        },
        periodB: {
          label: 'Mar',
          startDate: '2026-03-01',
          endDate: '2026-03-31',
        },
      },
    ],
  ])(
    '%s refuses a date that is not a real calendar day before any query',
    async (name, toolArguments) => {
      const outcome = await call({ client, name, toolArguments });

      expect(outcome.isError).toBe(true);
      expect(outcome.text).toContain('Use a real calendar day as YYYY-MM-DD');
      expect(transactionRepository.getTransactions).not.toHaveBeenCalled();
      expect(
        transactionRepository.getTransactionsSummary,
      ).not.toHaveBeenCalled();
    },
  );

  it('trends a category over its whole subtree', async () => {
    const outcome = await call({
      client,
      name: 'get_spending_trends',
      toolArguments: { period: 'monthly', categoryName: 'groceries' },
    });

    expect(outcome.text).toContain(
      'Category: Food & Groceries (including its subcategories)',
    );
    expect(transactionRepository.getTransactions).toHaveBeenCalledWith(
      expect.objectContaining({ categoryIds: ['c-food', 'c-fast'] }),
    );
  });

  it('lists recurring transactions with their category names', async () => {
    scheduledTransactionService.listScheduledTransactions.mockResolvedValue([
      {
        id: 's-1',
        description: 'Rent',
        value: 5000,
        type: 'EXPENSE',
        categoryId: 'c-rent',
        scheduleType: 'MONTHLY',
        dayOfMonth: 1,
        nextRunDate: new Date('2026-11-01T00:00:00Z'),
        userId: USER_ID,
      },
    ]);

    const outcome = await call({
      client,
      name: 'list_scheduled_transactions',
    });

    expect(outcome.text).toContain('Rent | ');
    expect(outcome.text).toContain('Runs every month on day 1.');
    expect(outcome.text).toContain('next 2026-11-01');
    expect(
      scheduledTransactionService.listScheduledTransactions,
    ).toHaveBeenCalledWith(USER_ID);
  });
});

// Each case runs on a host whose offset shifts the day under the wrong formatter.
describe('dates in tool output', () => {
  it('heads a spending trend with plain days on a host west of UTC', async () => {
    vi.stubEnv('TZ', 'America/Los_Angeles');

    const outcome = await call({
      client,
      name: 'get_spending_trends',
      toolArguments: {
        period: 'monthly',
        startDate: '2026-07-01',
        endDate: '2026-10-24',
      },
    });

    expect(outcome.text).toContain(
      'Spending trend (monthly) from 2026-07-01 to 2026-10-24:',
    );
  });

  it.each([
    ['America/Los_Angeles', '2026-10-20T00:00:00Z'],
    ['Asia/Jerusalem', '2026-10-20T23:30:00Z'],
  ])(
    'lists a transaction under its stored day on a %s host',
    async (timeZone, storedDate) => {
      vi.stubEnv('TZ', timeZone);
      transactionRepository.getTransactions.mockResolvedValue([
        transaction({ date: new Date(storedDate) }),
      ]);

      const outcome = await call({ client, name: 'find_transactions' });

      expect(outcome.text).toContain(`id ${TRANSACTION_ID} | 2026-10-20 |`);
    },
  );

  it("names a schedule's next run by its local day on a host east of UTC", async () => {
    vi.stubEnv('TZ', 'Asia/Jerusalem');
    scheduledTransactionService.listScheduledTransactions.mockResolvedValue([
      {
        id: 's-1',
        description: 'Rent',
        value: 5000,
        type: 'EXPENSE',
        categoryId: 'c-rent',
        scheduleType: 'MONTHLY',
        dayOfMonth: 1,
        nextRunDate: new Date(2026, 10, 1),
        userId: USER_ID,
      },
    ]);

    const outcome = await call({
      client,
      name: 'list_scheduled_transactions',
    });

    expect(outcome.text).toContain('next 2026-11-01');
  });
});

describe('add_transaction', () => {
  it('records a shekel expense as its ILS value and lets the app categorize it', async () => {
    const outcome = await call({
      client,
      name: 'add_transaction',
      toolArguments: {
        description: 'קפה בארומה',
        amount: 18,
        date: '2026-10-20',
      },
    });

    expect(outcome.isError).toBe(false);
    expect(outcome.text).toContain('Added:');
    expect(outcome.text).toContain('Fast Food');
    expect(transactionService.createTransaction).toHaveBeenCalledWith({
      description: 'קפה בארומה',
      currency: 'ILS',
      value: 18,
      type: 'EXPENSE',
      date: new Date('2026-10-20'),
      categoryId: null,
      userId: USER_ID,
    });
  });

  it("dates an undated transaction by today's wall clock in Israel, not UTC", async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T22:30:00Z'));

    await call({
      client,
      name: 'add_transaction',
      toolArguments: { description: 'פלאפל', amount: 25 },
    });

    expect(transactionService.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ date: new Date('2026-10-21T01:30:00Z') }),
    );
  });

  it.each(['2026-02-31', '2026-13-45'])(
    'refuses %s, which is no calendar day',
    async (date) => {
      const outcome = await call({
        client,
        name: 'add_transaction',
        toolArguments: { description: 'Coffee', amount: 18, date },
      });

      expect(outcome.isError).toBe(true);
      expect(transactionService.createTransaction).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['amount', { amount: 1e12 }],
    ['ilsAmount', { amount: 100, currency: 'USD', ilsAmount: 1e12 }],
  ])('refuses an implausibly large %s', async (_field, amounts) => {
    const outcome = await call({
      client,
      name: 'add_transaction',
      toolArguments: { description: 'Typo', ...amounts },
    });

    expect(outcome.isError).toBe(true);
    expect(transactionService.createTransaction).not.toHaveBeenCalled();
  });

  it('logs the call with the id of the transaction it wrote', async () => {
    await call({
      client,
      name: 'add_transaction',
      toolArguments: { description: 'קפה בארומה', amount: 18 },
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        toolName: 'add_transaction',
        outcome: 'ok',
        transactionId: TRANSACTION_ID,
      }),
      'MCP tool call',
    );
  });

  it('hands a foreign amount to the conversion service unconverted', async () => {
    await call({
      client,
      name: 'add_transaction',
      toolArguments: { description: 'Netflix', amount: 25, currency: 'usd' },
    });

    expect(transactionService.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'USD',
        originalAmount: 25,
        value: undefined,
      }),
    );
  });

  it('passes a known ILS charge for a foreign amount as its value', async () => {
    await call({
      client,
      name: 'add_transaction',
      toolArguments: {
        description: 'Hotel',
        amount: 100,
        currency: 'EUR',
        ilsAmount: 392.1,
      },
    });

    expect(transactionService.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        currency: 'EUR',
        originalAmount: 100,
        value: 392.1,
      }),
    );
  });

  it('refuses an ILS amount stated twice', async () => {
    const outcome = await call({
      client,
      name: 'add_transaction',
      toolArguments: { description: 'Coffee', amount: 18, ilsAmount: 18 },
    });

    expect(outcome.isError).toBe(true);
    expect(outcome.text).toContain('ilsAmount is only for a foreign-currency');
    expect(transactionService.createTransaction).not.toHaveBeenCalled();
  });

  it('files under the named category', async () => {
    await call({
      client,
      name: 'add_transaction',
      toolArguments: {
        description: 'שכירות',
        amount: 5000,
        categoryName: 'Rent',
      },
    });

    expect(transactionService.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'c-rent' }),
    );
  });

  it('relays a missing exchange rate instead of guessing one', async () => {
    transactionService.createTransaction.mockRejectedValue(
      new HttpError(
        422,
        'No exchange rate is available for THB on 2026-10-20.',
      ),
    );

    const outcome = await call({
      client,
      name: 'add_transaction',
      toolArguments: { description: 'Taxi', amount: 300, currency: 'THB' },
    });

    expect(outcome.isError).toBe(true);
    expect(outcome.text).toContain('No exchange rate is available for THB');
    expect(reportSwallowedError).not.toHaveBeenCalled();
  });

  it('rejects an unknown currency code before any write', async () => {
    const outcome = await call({
      client,
      name: 'add_transaction',
      toolArguments: { description: 'Taxi', amount: 300, currency: 'XYZ1' },
    });

    expect(outcome.isError).toBe(true);
    expect(transactionService.createTransaction).not.toHaveBeenCalled();
  });
});

describe('update_transaction', () => {
  it('keeps every field the agent did not mention, amount included', async () => {
    const foreign = transaction({
      currency: 'USD',
      originalAmount: 25,
      value: 92.35,
    });
    transactionService.getTransactionItem.mockResolvedValue(foreign);

    await call({
      client,
      name: 'update_transaction',
      toolArguments: { id: TRANSACTION_ID, description: 'Netflix' },
    });

    expect(transactionService.updateTransaction).toHaveBeenCalledWith(
      TRANSACTION_ID,
      {
        description: 'Netflix',
        currency: 'USD',
        originalAmount: 25,
        categoryId: 'c-fast',
        type: 'EXPENSE',
        date: foreign.date,
      },
      USER_ID,
    );
  });

  it('moves the transaction to a named category', async () => {
    await call({
      client,
      name: 'update_transaction',
      toolArguments: { id: TRANSACTION_ID, categoryName: 'Rent', amount: 20 },
    });

    expect(transactionService.updateTransaction).toHaveBeenCalledWith(
      TRANSACTION_ID,
      expect.objectContaining({
        categoryId: 'c-rent',
        currency: 'ILS',
        value: 20,
      }),
      USER_ID,
    );
  });

  it('refuses a currency change without the amount in that currency', async () => {
    const outcome = await call({
      client,
      name: 'update_transaction',
      toolArguments: { id: TRANSACTION_ID, currency: 'USD' },
    });

    expect(outcome.isError).toBe(true);
    expect(outcome.text).toContain('from ILS to USD needs the amount');
    expect(transactionService.updateTransaction).not.toHaveBeenCalled();
  });

  it('answers with the updated row as stored', async () => {
    transactionService.updateTransaction.mockResolvedValue(
      transaction({ description: 'Netflix' }),
    );

    const outcome = await call({
      client,
      name: 'update_transaction',
      toolArguments: { id: TRANSACTION_ID, description: 'Netflix' },
    });

    expect(outcome.text).toContain('Updated:');
    expect(outcome.text).toContain('Netflix');
    expect(transactionService.getTransactionItem).toHaveBeenCalledTimes(1);
  });

  it("reports a transaction the token owner doesn't have as not found", async () => {
    transactionService.getTransactionItem.mockResolvedValue(null);

    const outcome = await call({
      client,
      name: 'update_transaction',
      toolArguments: { id: TRANSACTION_ID, amount: 20 },
    });

    expect(outcome.isError).toBe(true);
    expect(outcome.text).toContain(`No transaction with id ${TRANSACTION_ID}`);
    expect(transactionService.getTransactionItem).toHaveBeenCalledWith(
      TRANSACTION_ID,
      USER_ID,
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'update_transaction',
        outcome: 'client_error',
      }),
      'MCP tool call',
    );
  });
});

describe('delete_transaction', () => {
  it("deletes the token owner's transaction and says which one", async () => {
    const outcome = await call({
      client,
      name: 'delete_transaction',
      toolArguments: { id: TRANSACTION_ID },
    });

    expect(outcome.text).toContain('Deleted:');
    expect(outcome.text).toContain('קפה בארומה');
    expect(transactionService.deleteTransaction).toHaveBeenCalledWith(
      TRANSACTION_ID,
      USER_ID,
    );
  });

  it('rejects an id that is not a uuid without touching the service', async () => {
    const outcome = await call({
      client,
      name: 'delete_transaction',
      toolArguments: { id: 'last-one' },
    });

    expect(outcome.isError).toBe(true);
    expect(transactionService.deleteTransaction).not.toHaveBeenCalled();
  });
});

describe('unexpected failures', () => {
  it('are reported and returned neutrally rather than thrown at the agent', async () => {
    transactionService.deleteTransaction.mockRejectedValue(
      new Error('connection reset by pooler'),
    );

    const outcome = await call({
      client,
      name: 'delete_transaction',
      toolArguments: { id: TRANSACTION_ID },
    });

    expect(outcome.isError).toBe(true);
    expect(outcome.text).not.toContain('pooler');
    expect(reportSwallowedError).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        toolName: 'delete_transaction',
      }),
      'MCP tool failed',
    );
  });
});
