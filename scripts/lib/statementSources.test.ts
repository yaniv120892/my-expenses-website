import { describe, expect, it } from 'vitest';
import { ImportStatus } from '../../src/shared/types/import';
import { DEFAULT_BASE_URL } from './importStatements';
import {
  type ImportSummary,
  type StatementSources,
  findDueStatements,
  parseDueArguments,
  parseStatementSources,
} from './statementSources';

function sources(
  cards: Record<string, unknown>[],
  startMonth = '08/2026',
  closedCards: Record<string, unknown>[] = [],
): StatementSources {
  return parseStatementSources(
    JSON.stringify({ startMonth, cards, closedCards }),
    'sources.json',
  );
}

const cal2923 = {
  issuer: 'cal',
  last4: '2923',
  holder: 'self',
  login: 'Cal (self)',
  billingDay: 15,
};

function imported(
  paymentMonth: string,
  createdAt: string,
  status = ImportStatus.COMPLETED,
): ImportSummary {
  return {
    creditCardLastFourDigits: '2923',
    paymentMonth,
    status,
    createdAt,
  };
}

function dueFiles(
  sourceList: StatementSources,
  imports: ImportSummary[],
  today: string,
): string[] {
  return findDueStatements(sourceList, imports, today).due.map(
    (statement) => statement.fileName,
  );
}

describe('findDueStatements', () => {
  it('lists every closed month with no import, named for the import script', () => {
    const report = findDueStatements(sources([cal2923]), [], '2026-10-20');
    expect(report.due.map((statement) => statement.fileName)).toEqual([
      'cal-2923-08-2026.xlsx',
      'cal-2923-09-2026.xlsx',
      'cal-2923-10-2026.xlsx',
    ]);
    expect(report.upcoming).toEqual([
      expect.objectContaining({
        paymentMonth: '11/2026',
        billingDate: '2026-11-15',
      }),
    ]);
  });

  it('holds back a month until its billing day', () => {
    const report = findDueStatements(sources([cal2923]), [], '2026-10-14');
    expect(report.due.map((statement) => statement.paymentMonth)).toEqual([
      '08/2026',
      '09/2026',
    ]);
    expect(report.upcoming).toEqual([
      expect.objectContaining({
        paymentMonth: '10/2026',
        billingDate: '2026-10-15',
      }),
    ]);
  });

  it('treats a month imported on or after its billing day as done', () => {
    const imports = [
      imported('08/2026', '2026-08-15T06:00:00Z'),
      imported('09/2026', '2026-09-20T06:00:00Z'),
    ];
    expect(dueFiles(sources([cal2923]), imports, '2026-09-30')).toEqual([]);
  });

  it('re-lists a month imported before it closed, naming when', () => {
    const imports = [imported('10/2026', '2026-10-10T06:00:00Z')];
    const report = findDueStatements(
      sources([cal2923], '10/2026'),
      imports,
      '2026-10-16',
    );
    expect(report.due).toEqual([
      expect.objectContaining({
        paymentMonth: '10/2026',
        importedBeforeBillingOn: '2026-10-10',
      }),
    ]);
  });

  it('dates an import by the Israeli calendar day', () => {
    // 22:30 UTC on the 14th is already the 15th in Israel.
    const imports = [imported('10/2026', '2026-10-14T22:30:00Z')];
    expect(
      dueFiles(sources([cal2923], '10/2026'), imports, '2026-10-16'),
    ).toEqual([]);
  });

  it('ignores a failed import but counts a merged one', () => {
    const report = (status: ImportStatus) =>
      dueFiles(
        sources([cal2923], '09/2026'),
        [imported('09/2026', '2026-09-20T06:00:00Z', status)],
        '2026-09-30',
      );
    expect(report(ImportStatus.FAILED)).toEqual(['cal-2923-09-2026.xlsx']);
    expect(report(ImportStatus.MERGED)).toEqual([]);
  });

  it('skips months before a card existed, and skipped months', () => {
    const sourceList = sources([
      { ...cal2923, firstMonth: '09/2026' },
      {
        ...cal2923,
        last4: '0329',
        issuer: 'isracard',
        skipMonths: { '08/2026': 'fee only, waived' },
      },
    ]);
    expect(dueFiles(sourceList, [], '2026-09-20')).toEqual([
      'cal-2923-09-2026.xlsx',
      'isracard-0329-09-2026.xlsx',
    ]);
  });

  it('bills a day past the month end on its last day', () => {
    const report = findDueStatements(
      sources([{ ...cal2923, billingDay: 31 }], '09/2026'),
      [],
      '2026-09-30',
    );
    expect(report.due[0]?.billingDate).toBe('2026-09-30');
  });
});

describe('parseStatementSources', () => {
  it('rejects a card listed twice', () => {
    expect(() => sources([cal2923, cal2923])).toThrow(
      'card 2923 is listed twice',
    );
  });

  it('rejects an active card that is also listed as closed', () => {
    expect(() =>
      sources([cal2923], '08/2026', [
        { issuer: 'cal', last4: '2923', holder: 'self' },
      ]),
    ).toThrow('card 2923 is listed twice');
  });

  it('names the offending field', () => {
    expect(() => sources([{ ...cal2923, billingDay: 40 }])).toThrow(
      'cards.0.billingDay',
    );
  });
});

describe('parseDueArguments', () => {
  it('defaults to the given sources path and the local target', () => {
    expect(parseDueArguments([], '/home/sources.json')).toEqual({
      sourcesPath: '/home/sources.json',
      baseUrl: DEFAULT_BASE_URL,
    });
  });

  it('reads both flags', () => {
    expect(
      parseDueArguments(
        ['--sources=/tmp/cards.json', '--base-url=https://example.com/'],
        '/home/sources.json',
      ),
    ).toEqual({
      sourcesPath: '/tmp/cards.json',
      baseUrl: 'https://example.com',
    });
  });

  it('rejects anything else', () => {
    expect(() => parseDueArguments(['--dry-run'], '/x')).toThrow(
      'Unexpected argument --dry-run',
    );
  });
});
