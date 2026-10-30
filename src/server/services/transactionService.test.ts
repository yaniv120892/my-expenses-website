import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import type * as ObservabilityModule from '@/server/observability';

const {
  findByDescription,
  getTransactionsList,
  getTransactionsSummary,
  getCategoryTotals,
  getAllCategories,
  reportError,
  createTransactionFile,
  findMembersNotifiedOfNewTransactions,
} = vi.hoisted(() => ({
  findMembersNotifiedOfNewTransactions: vi.fn(),
  getCategoryTotals: vi.fn(),
  findByDescription: vi.fn(),
  getTransactionsList: vi.fn(),
  getTransactionsSummary: vi.fn(),
  getAllCategories: vi.fn(),
  reportError: vi.fn(),
  createTransactionFile: vi.fn(),
}));

vi.mock('@/server/repositories/userCategoryMappingRepository', () => ({
  default: { findByDescription },
}));

vi.mock('@/server/repositories/transactionRepository', () => ({
  default: { getTransactionsList, getTransactionsSummary, getCategoryTotals },
}));

vi.mock('@/server/repositories/categoryRepository', () => ({
  default: { getAllCategories },
}));

vi.mock('@/server/repositories/transactionFileRepository', () => ({
  default: { create: createTransactionFile },
}));

vi.mock('@/server/services/userSettingsService', () => ({
  default: { findMembersNotifiedOfNewTransactions },
}));

vi.mock('@/server/observability', async (importOriginal) => ({
  ...(await importOriginal<typeof ObservabilityModule>()),
  observability: { reportError },
}));

import transactionService from '@/server/services/transactionService';
import { logger } from '@/server/observability';
import { MAX_UPLOAD_BYTES } from '@/shared/uploadLimits';
import type { Category } from '@/shared/types/category';
import type { CreateTransaction } from '@/shared/types/transaction';
import type { CategorySuggester } from '@/server/services/ai/aiProvider';
import { testMemberActor } from '@/test/memberActor';
import { systemActor } from '@/server/auth/householdActor';
import type { TransactionNotifier } from '@/server/services/transactionNotification/transactionNotifier';

const ACTOR = testMemberActor({ userId: 'user-1' });
const HOUSEHOLD_ID = ACTOR.householdId;

const CATEGORIES: Category[] = [
  { id: 'cat-food', name: 'Food' },
  { id: 'cat-rent', name: 'Rent' },
];

const suggestCategory = vi.fn();
const categorySuggester: CategorySuggester = {
  suggestCategory,
  evaluateCategory: vi.fn(),
  modelName: () => 'test-model',
};

const getSuggestedCategory = () =>
  transactionService['getSuggestedCategory'](HOUSEHOLD_ID, 'Pizza', CATEGORIES);

beforeEach(() => {
  vi.clearAllMocks();
  findByDescription.mockResolvedValue(null);
  suggestCategory.mockResolvedValue('cat-ai');
  transactionService['getCategorySuggester'] = () => categorySuggester;
});

describe('getAllTransactions', () => {
  const page = (ids: string[], nextCursor: string | null) => ({
    items: ids.map((id) => ({ id })),
    nextCursor,
  });

  it('follows the cursor to the end and concatenates the pages', async () => {
    getTransactionsList
      .mockResolvedValueOnce(page(['t1', 't2'], 'cursor-1'))
      .mockResolvedValueOnce(page(['t3'], null));

    const transactions = await transactionService.getAllTransactions(HOUSEHOLD_ID, {});

    expect(transactions.map((transaction) => transaction.id)).toEqual(['t1', 't2', 't3']);
    expect(getTransactionsList).toHaveBeenCalledTimes(2);
    expect(getTransactionsList.mock.calls[0]?.[0]).toBe(HOUSEHOLD_ID);
    expect(getTransactionsList.mock.calls[1]?.[0]).toBe(HOUSEHOLD_ID);
    expect(getTransactionsList.mock.calls[0]?.[1].cursor).toBeUndefined();
    expect(getTransactionsList.mock.calls[1]?.[1].cursor).toBe('cursor-1');
  });

  it('carries the caller filters and the approved default into the walk', async () => {
    getTransactionsList.mockResolvedValueOnce(page([], null));

    await transactionService.getAllTransactions(HOUSEHOLD_ID, {
      transactionType: 'EXPENSE',
      searchTerm: 'taxi',
    });

    expect(getTransactionsList).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      expect.objectContaining({
        transactionType: 'EXPENSE',
        searchTerm: 'taxi',
        status: 'APPROVED',
      }),
    );
  });
});

describe('category subtree resolution', () => {
  const CATEGORY_TREE = [
    { id: 'cat-food', parentId: null },
    { id: 'cat-groceries', parentId: 'cat-food' },
    { id: 'cat-organic', parentId: 'cat-groceries' },
    { id: 'cat-rent', parentId: null },
  ];
  const listArgs = (call = 0) => {
    const [householdId, args] = getTransactionsList.mock.calls[call] ?? [];
    expect(householdId).toBe(HOUSEHOLD_ID);
    if (!args) {
      throw new Error(`getTransactionsList call ${call} never happened`);
    }
    return args;
  };

  beforeEach(() => {
    getAllCategories.mockResolvedValue(CATEGORY_TREE);
    getTransactionsList.mockResolvedValue({ items: [], nextCursor: null });
    getTransactionsSummary.mockResolvedValue({
      totalIncome: 0,
      totalExpense: 0,
      count: 0,
    });
  });

  it('expands a parent category to its whole subtree', async () => {
    await transactionService.getTransactionsList(HOUSEHOLD_ID, {
      categoryId: 'cat-food',
      limit: 50,
    });

    expect(listArgs().categoryIds).toEqual(['cat-food', 'cat-groceries', 'cat-organic']);
  });

  it('resolves a leaf category to itself', async () => {
    await transactionService.getTransactionsList(HOUSEHOLD_ID, {
      categoryId: 'cat-organic',
      limit: 50,
    });

    expect(listArgs().categoryIds).toEqual(['cat-organic']);
  });

  it('leaves an unfiltered request without category ids', async () => {
    await transactionService.getTransactionsList(HOUSEHOLD_ID, {
      limit: 50,
    });

    expect(listArgs().categoryIds).toBeUndefined();
    expect(getAllCategories).not.toHaveBeenCalled();
  });

  it('expands the summary the same way as the list', async () => {
    await transactionService.getTransactionsSummary(HOUSEHOLD_ID, {
      categoryId: 'cat-groceries',
    });

    expect(getTransactionsSummary.mock.calls[0]?.[0]).toBe(HOUSEHOLD_ID);
    expect(getTransactionsSummary.mock.calls[0]?.[1].categoryIds).toEqual([
      'cat-groceries',
      'cat-organic',
    ]);
  });

  it('resolves once for the whole getAllTransactions walk', async () => {
    getTransactionsList
      .mockResolvedValueOnce({ items: [{ id: 't1' }], nextCursor: 'cursor-1' })
      .mockResolvedValueOnce({ items: [{ id: 't2' }], nextCursor: null });

    await transactionService.getAllTransactions(HOUSEHOLD_ID, {
      categoryId: 'cat-food',
    });

    expect(getAllCategories).toHaveBeenCalledTimes(1);
    expect(listArgs(1).categoryIds).toEqual(listArgs(0).categoryIds);
  });
});

describe('getCategoryBreakdown', () => {
  it('names top-level slices, drops empty ones and gives each its share', async () => {
    getAllCategories.mockResolvedValue([
      { id: 'food', name: 'Food', parentId: null },
      { id: 'groceries', name: 'Groceries', parentId: 'food' },
      { id: 'rent', name: 'Rent', parentId: null },
      { id: 'fun', name: 'Fun', parentId: null },
    ]);
    getCategoryTotals.mockResolvedValue([
      { categoryId: 'groceries', amount: 300 },
      { categoryId: 'food', amount: 100 },
      { categoryId: 'rent', amount: 600 },
      { categoryId: 'fun', amount: 0 },
      { categoryId: 'gone', amount: 0 },
    ]);

    const items = await transactionService.getCategoryBreakdown(HOUSEHOLD_ID, {
      transactionType: 'EXPENSE',
    });

    expect(items).toEqual([
      { categoryId: 'rent', categoryName: 'Rent', amount: 600, percentage: 60 },
      { categoryId: 'food', categoryName: 'Food', amount: 400, percentage: 40 },
    ]);
    expect(getCategoryTotals).toHaveBeenCalledWith(
      HOUSEHOLD_ID,
      expect.objectContaining({
        status: 'APPROVED',
        transactionType: 'EXPENSE',
      }),
    );
  });

  it('returns no slices when nothing matched', async () => {
    getAllCategories.mockResolvedValue([]);
    getCategoryTotals.mockResolvedValue([]);
    await expect(transactionService.getCategoryBreakdown(HOUSEHOLD_ID, {})).resolves.toEqual([]);
  });
});

describe('getSuggestedCategory', () => {
  it('returns a user mapping that resolves to a known category', async () => {
    findByDescription.mockResolvedValue({ categoryId: 'cat-rent' });
    expect(await getSuggestedCategory()).toBe('cat-rent');
    expect(suggestCategory).not.toHaveBeenCalled();
  });

  it('normalizes the description before looking up a mapping', async () => {
    await transactionService['getSuggestedCategory'](HOUSEHOLD_ID, '  PiZZa  ', CATEGORIES);
    expect(findByDescription).toHaveBeenCalledWith(HOUSEHOLD_ID, 'pizza');
  });

  it.each([
    ['no mapping exists', () => findByDescription.mockResolvedValue(null)],
    [
      'the mapped category no longer exists',
      () => findByDescription.mockResolvedValue({ categoryId: 'cat-gone' }),
    ],
    ['the mapping lookup fails', () => findByDescription.mockRejectedValue(new Error('db down'))],
  ])('asks the AI service when %s', async (_case, arrange) => {
    arrange();
    expect(await getSuggestedCategory()).toBe('cat-ai');
    expect(suggestCategory).toHaveBeenCalledWith('Pizza', CATEGORIES);
  });

  it('reports a failed mapping lookup instead of only logging it', async () => {
    const err = new Error('db down');
    findByDescription.mockRejectedValue(err);
    await getSuggestedCategory();
    expect(reportError).toHaveBeenCalledWith({
      error: err,
      where: 'Failed to check the category mapping',
      context: { householdId: HOUSEHOLD_ID },
    });
  });

  it('returns null when the AI service has no answer', async () => {
    suggestCategory.mockResolvedValue(null);
    expect(await getSuggestedCategory()).toBeNull();
  });
});

describe('attachFile', () => {
  const TRANSACTION_ID = '11111111-1111-4111-8111-111111111111';
  const attach = (fileKey: string, fileSize = 10) =>
    transactionService.attachFile(ACTOR, TRANSACTION_ID, {
      fileName: 'receipt.pdf',
      fileKey,
      fileSize,
      mimeType: 'application/pdf',
    });

  beforeEach(() => {
    transactionService.getTransactionItem = vi.fn().mockResolvedValue({
      id: TRANSACTION_ID,
    });
  });

  it('stores a key issued under this transaction', async () => {
    await attach(`transactions/${TRANSACTION_ID}/uuid-receipt.pdf`);

    expect(createTransactionFile).toHaveBeenCalledTimes(1);
  });

  it('logs the key and size, never the file name', async () => {
    const debug = vi.spyOn(logger, 'debug');
    onTestFinished(() => debug.mockRestore());
    const fileKey = `transactions/${TRANSACTION_ID}/uuid.pdf`;

    await attach(fileKey);

    expect(JSON.stringify(debug.mock.calls)).not.toContain('receipt');
    expect(debug).toHaveBeenCalledWith(
      { transactionId: TRANSACTION_ID, fileKey, fileSize: 10, mimeType: 'application/pdf' },
      'File attached to transaction',
    );
  });

  it.each([
    ['another transaction', 'transactions/22222222-2222-4222-8222-222222222222/uuid-x.pdf'],
    ['a key outside the attachments prefix', 'imports/someone-else.xlsx'],
    ['a dot segment', `transactions/${TRANSACTION_ID}/../other/x.pdf`],
    ['the bare prefix', `transactions/${TRANSACTION_ID}/`],
  ])('400s for %s without storing it', async (_label, fileKey) => {
    await expect(attach(fileKey)).rejects.toMatchObject({ status: 400 });
    expect(createTransactionFile).not.toHaveBeenCalled();
  });

  it('413s a file declared over 4 MB without storing it', async () => {
    await expect(
      attach(`transactions/${TRANSACTION_ID}/uuid-receipt.pdf`, MAX_UPLOAD_BYTES + 1),
    ).rejects.toMatchObject({
      status: 413,
      message: 'receipt.pdf is 4.1 MB, over the 4 MB upload limit.',
    });
    expect(createTransactionFile).not.toHaveBeenCalled();
  });
});

describe('getPresignedUploadUrl', () => {
  const TRANSACTION_ID = '11111111-1111-4111-8111-111111111111';
  const presign = (fileSize: number) =>
    transactionService.getPresignedUploadUrl(ACTOR, TRANSACTION_ID, {
      fileName: 'receipt.pdf',
      mimeType: 'application/pdf',
      fileSize,
    });

  beforeEach(() => {
    process.env.TRANSACTION_ATTACHMENT_S3_REGION = 'eu-central-1';
    process.env.TRANSACTION_ATTACHMENT_S3_ACCESS_KEY_ID = 'key';
    process.env.TRANSACTION_ATTACHMENT_S3_SECRET_ACCESS_KEY = 'secret';
    process.env.TRANSACTION_ATTACHMENT_S3_BUCKET_NAME = 'bucket';
    transactionService.getTransactionItem = vi.fn().mockResolvedValue({
      id: TRANSACTION_ID,
    });
  });

  it('issues an upload URL for a file of exactly 4 MB', async () => {
    const { fileKey } = await presign(MAX_UPLOAD_BYTES);

    expect(fileKey).toMatch(`transactions/${TRANSACTION_ID}/`);
  });

  it('413s a file one byte over 4 MB before any URL is signed', async () => {
    await expect(presign(MAX_UPLOAD_BYTES + 1)).rejects.toMatchObject({
      status: 413,
      message: 'receipt.pdf is 4.1 MB, over the 4 MB upload limit.',
    });
  });
});

describe('prepareCreateTransaction', () => {
  const FALAFEL: CreateTransaction = {
    description: 'Falafel',
    categoryId: 'cat-food',
    date: new Date('2026-08-26T00:30:00Z'),
    value: 30,
    type: 'EXPENSE',
    resolvedAmount: {
      value: 30,
      currency: 'ILS',
      originalAmount: 30,
      exchangeRate: null,
      exchangeRateDate: null,
      exchangeRateSource: null,
    },
  };

  beforeEach(() => {
    transactionService['updateCategory'] = async (_householdId, data: CreateTransaction) => ({
      ...data,
      categoryId: 'cat-food',
    });
    transactionService['validateCreateTransaction'] = async () => undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stamps an undated create with the app wall-clock time, so a late-evening entry keeps its local day', async () => {
    vi.useFakeTimers();
    // 00:30 on the 26th in Israel (UTC+3).
    vi.setSystemTime(new Date('2026-08-25T21:30:00Z'));

    const model = await transactionService.prepareCreateTransaction(ACTOR, {
      description: 'Falafel',
      categoryId: 'cat-food',
      date: null,
      value: 30,
      type: 'EXPENSE',
      resolvedAmount: {
        value: 30,
        currency: 'ILS',
        originalAmount: 30,
        exchangeRate: null,
        exchangeRateDate: null,
        exchangeRateSource: null,
      },
    });

    expect(model.date).toEqual(new Date('2026-08-26T00:30:00Z'));
  });

  it('records a member write in the actor household, against that member', async () => {
    const model = await transactionService.prepareCreateTransaction(ACTOR, FALAFEL);

    expect(model).toMatchObject({ householdId: HOUSEHOLD_ID, userId: 'user-1' });
  });

  it('records a system write in its household, against no member', async () => {
    const model = await transactionService.prepareCreateTransaction(
      systemActor({ householdId: HOUSEHOLD_ID, job: 'scheduled-transactions' }),
      FALAFEL,
    );

    expect(model).toMatchObject({ householdId: HOUSEHOLD_ID, userId: null });
  });
});

describe('notifyTransactionsCreatedSafe', () => {
  const notifyTransactionCreated = vi.fn();
  const notifier: TransactionNotifier = { notifyTransactionCreated, sendDailySummary: vi.fn() };
  const approved = { id: 'tx-1', status: 'APPROVED' };

  beforeEach(() => {
    transactionService['getTransactionNotifier'] = () => notifier;
    transactionService.getTransactionItem = vi.fn().mockResolvedValue(approved);
  });

  it('tells every member of the household who asked to hear of new transactions', async () => {
    findMembersNotifiedOfNewTransactions.mockResolvedValue(['user-1', 'user-2']);

    await transactionService.notifyTransactionsCreatedSafe(HOUSEHOLD_ID, ['tx-1']);

    expect(findMembersNotifiedOfNewTransactions).toHaveBeenCalledWith(HOUSEHOLD_ID);
    expect(transactionService.getTransactionItem).toHaveBeenCalledWith(HOUSEHOLD_ID, 'tx-1');
    expect(notifyTransactionCreated.mock.calls).toEqual([
      [approved, 'user-1'],
      [approved, 'user-2'],
    ]);
  });

  it('still tells the other members when one member cannot be reached', async () => {
    findMembersNotifiedOfNewTransactions.mockResolvedValue(['user-1', 'user-2']);
    notifyTransactionCreated.mockRejectedValueOnce(new Error('chat blocked'));

    await transactionService.notifyTransactionsCreatedSafe(HOUSEHOLD_ID, ['tx-1']);

    expect(notifyTransactionCreated).toHaveBeenLastCalledWith(approved, 'user-2');
    expect(notifyTransactionCreated).toHaveBeenCalledTimes(2);
  });

  it('reads no transaction when no member asked to be told', async () => {
    findMembersNotifiedOfNewTransactions.mockResolvedValue([]);

    await transactionService.notifyTransactionsCreatedSafe(HOUSEHOLD_ID, ['tx-1']);

    expect(transactionService.getTransactionItem).not.toHaveBeenCalled();
    expect(notifyTransactionCreated).not.toHaveBeenCalled();
  });
});
