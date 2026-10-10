import { z } from 'zod';
import { ImportStatus } from '../../src/shared/types/import';
import {
  BASE_URL_FLAG,
  DEFAULT_BASE_URL,
  parseBaseUrl,
} from './importStatements';

const STATEMENT_ISSUERS = ['cal', 'isracard', 'amex'] as const;
const PAYMENT_MONTH_PATTERN = /^(0[1-9]|1[0-2])\/(\d{4})$/;
const ISRAEL_TIME_ZONE = 'Asia/Jerusalem';
const SOURCES_FLAG = '--sources=';
const USAGE =
  'Usage: tsx scripts/statements-due.ts [--sources=<json>] [--base-url=<url>]';

const paymentMonthSchema = z
  .string()
  .regex(PAYMENT_MONTH_PATTERN, 'expected a month as MM/YYYY');

const closedCardSchema = z.object({
  issuer: z.enum(STATEMENT_ISSUERS),
  last4: z.string().regex(/^\d{4}$/, 'expected the last four card digits'),
  holder: z.string().min(1),
  note: z.string().optional(),
});

const statementCardSchema = closedCardSchema.extend({
  login: z.string().min(1),
  billingDay: z.number().int().min(1).max(31),
  firstMonth: paymentMonthSchema.optional(),
  skipMonths: z.record(paymentMonthSchema, z.string().min(1)).default({}),
});

const statementSourcesSchema = z
  .object({
    startMonth: paymentMonthSchema,
    cards: z.array(statementCardSchema).min(1),
    closedCards: z.array(closedCardSchema).default([]),
  })
  .superRefine(({ cards, closedCards }, context) => {
    const seen = new Set<string>();
    for (const card of [...cards, ...closedCards]) {
      if (seen.has(card.last4)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `card ${card.last4} is listed twice`,
        });
      }
      seen.add(card.last4);
    }
  });

export type StatementCard = z.infer<typeof statementCardSchema>;
export type StatementSources = z.infer<typeof statementSourcesSchema>;

export type ImportSummary = {
  creditCardLastFourDigits?: string | null;
  paymentMonth?: string | null;
  status: ImportStatus;
  createdAt: string;
};

export type DueStatement = {
  card: StatementCard;
  paymentMonth: string;
  billingDate: string;
  fileName: string;
  // Set when the month was imported before its billing day, so what landed
  // was a partial statement.
  importedBeforeBillingOn?: string;
};

export type UpcomingStatement = {
  card: StatementCard;
  paymentMonth: string;
  billingDate: string;
};

export type DueArguments = {
  sourcesPath: string;
  baseUrl: string;
};

export type DueReport = {
  due: DueStatement[];
  upcoming: UpcomingStatement[];
};

// An import that failed holds no rows; one still in flight will hold them.
const COVERS_ITS_MONTH = {
  [ImportStatus.PENDING]: true,
  [ImportStatus.PROCESSING]: true,
  [ImportStatus.COMPLETED]: true,
  [ImportStatus.REMATCHING]: true,
  [ImportStatus.MERGED]: true,
  [ImportStatus.FAILED]: false,
} satisfies Record<ImportStatus, boolean>;

export function parseDueArguments(
  args: string[],
  defaultSourcesPath: string,
): DueArguments {
  let sourcesPath = defaultSourcesPath;
  let baseUrl = DEFAULT_BASE_URL;
  for (const arg of args) {
    if (arg.startsWith(SOURCES_FLAG)) {
      sourcesPath = arg.slice(SOURCES_FLAG.length);
      continue;
    }
    if (arg.startsWith(BASE_URL_FLAG)) {
      baseUrl = parseBaseUrl(arg.slice(BASE_URL_FLAG.length), USAGE);
      continue;
    }
    throw new Error(`Unexpected argument ${arg}\n${USAGE}`);
  }
  return { sourcesPath, baseUrl };
}

export function parseStatementSources(
  text: string,
  source: string,
): StatementSources {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`${source} is not valid JSON`);
  }
  const parsed = statementSourcesSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      `${source} is not a statement sources file: ${issue?.path.join('.') ?? ''} ${issue?.message ?? 'invalid'}`,
    );
  }
  return parsed.data;
}

// A month is due once its billing day has passed and no import of it was made
// on or after that day; an earlier import caught the statement mid-cycle.
export function findDueStatements(
  sources: StatementSources,
  imports: ImportSummary[],
  today: string,
): DueReport {
  const importDatesByStatement = groupImportDates(imports);
  const due: DueStatement[] = [];
  const upcoming: UpcomingStatement[] = [];

  for (const card of sources.cards) {
    const firstMonth = laterMonth(sources.startMonth, card.firstMonth);
    for (const paymentMonth of monthsThroughNext(firstMonth, today)) {
      const billingDate = billingDateOf(paymentMonth, card.billingDay);
      if (billingDate > today) {
        upcoming.push({ card, paymentMonth, billingDate });
        break;
      }
      if (paymentMonth in card.skipMonths) {
        continue;
      }

      const importDates =
        importDatesByStatement.get(statementKey(card.last4, paymentMonth)) ??
        [];
      const importedAfterBilling = importDates.some(
        (importDate) => importDate >= billingDate,
      );
      if (importedAfterBilling) {
        continue;
      }

      due.push({
        card,
        paymentMonth,
        billingDate,
        fileName: statementFileName(card, paymentMonth),
        importedBeforeBillingOn: importDates.sort().at(-1),
      });
    }
  }

  upcoming.sort((first, second) =>
    first.billingDate.localeCompare(second.billingDate),
  );
  return { due, upcoming };
}

export function statementFileName(
  card: StatementCard,
  paymentMonth: string,
): string {
  const [month, year] = paymentMonth.split('/');
  return `${card.issuer}-${card.last4}-${month}-${year}.xlsx`;
}

export function israelDate(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ISRAEL_TIME_ZONE,
  }).format(instant);
}

function groupImportDates(imports: ImportSummary[]): Map<string, string[]> {
  const datesByStatement = new Map<string, string[]>();
  for (const importRecord of imports) {
    const { creditCardLastFourDigits, paymentMonth, status } = importRecord;
    const isUsable =
      COVERS_ITS_MONTH[status] &&
      Boolean(creditCardLastFourDigits) &&
      PAYMENT_MONTH_PATTERN.test(paymentMonth ?? '');
    if (!isUsable) {
      continue;
    }

    const key = statementKey(
      creditCardLastFourDigits ?? '',
      paymentMonth ?? '',
    );
    const dates = datesByStatement.get(key) ?? [];
    dates.push(israelDate(new Date(importRecord.createdAt)));
    datesByStatement.set(key, dates);
  }
  return datesByStatement;
}

function statementKey(last4: string, paymentMonth: string): string {
  return `${last4} ${paymentMonth}`;
}

function laterMonth(first: string, second: string | undefined): string {
  if (!second) {
    return first;
  }
  return monthIndex(second) > monthIndex(first) ? second : first;
}

// Runs one month past today's, whose billing day is always still ahead, so
// every card yields its next statement to close.
function* monthsThroughNext(
  firstMonth: string,
  today: string,
): Generator<string> {
  const [todayYear, todayMonth] = today.split('-').map(Number);
  const lastIndex = todayYear * 12 + todayMonth;
  for (let index = monthIndex(firstMonth); index <= lastIndex; index++) {
    const month = String((index % 12) + 1).padStart(2, '0');
    yield `${month}/${Math.floor(index / 12)}`;
  }
}

function monthIndex(paymentMonth: string): number {
  const [month, year] = paymentMonth.split('/').map(Number);
  return year * 12 + month - 1;
}

// A billing day past the month's end bills on its last day.
function billingDateOf(paymentMonth: string, billingDay: number): string {
  const [month, year] = paymentMonth.split('/').map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(billingDay, daysInMonth);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
