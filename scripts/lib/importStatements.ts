/**
 * The pure parts of `scripts/import-statements.ts`, kept apart from the script
 * so they can be unit tested: the script runs on import.
 */
import { basename, extname } from 'path';

export type ImportArguments = {
  directory: string;
  dryRun: boolean;
  baseUrl: string;
};

export type ParsedStatementName = {
  cardLastFour: string;
  paymentMonth: string;
};

export const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';

const USAGE =
  'Usage: tsx scripts/import-statements.ts <dir> [--dry-run] [--base-url=<url>]';
const DRY_RUN_FLAG = '--dry-run';
const BASE_URL_FLAG = '--base-url=';
const STATEMENT_NAME_PATTERN = /^(.+)-(\d{4})-(\d{2})-(\d{4})$/;

export function parseImportArguments(args: string[]): ImportArguments {
  let directory: string | undefined;
  let dryRun = false;
  let baseUrl = DEFAULT_BASE_URL;

  for (const arg of args) {
    if (arg === DRY_RUN_FLAG) {
      dryRun = true;
      continue;
    }
    if (arg.startsWith(BASE_URL_FLAG)) {
      baseUrl = parseBaseUrl(arg.slice(BASE_URL_FLAG.length));
      continue;
    }
    if (arg.startsWith('--')) {
      throw new Error(`Unknown option ${arg}\n${USAGE}`);
    }
    if (directory !== undefined) {
      throw new Error(
        `Unexpected argument ${arg}; the script takes one directory\n${USAGE}`,
      );
    }
    directory = arg;
  }

  if (!directory) {
    throw new Error(USAGE);
  }

  return { directory, dryRun, baseUrl };
}

/**
 * `<issuer>-<last4>-<MM>-<YYYY>.xlsx` carries the payment month the dialog
 * would otherwise ask for per batch, and identifies the import to follow when a
 * duplicate is merged away.
 */
export function parseStatementName(
  fileName: string,
): ParsedStatementName | null {
  const match = STATEMENT_NAME_PATTERN.exec(
    basename(fileName, extname(fileName)),
  );
  if (!match) {
    return null;
  }

  const [, , cardLastFour, month, year] = match;
  return { cardLastFour, paymentMonth: `${month}/${year}` };
}

type DatedRecord = { id: string; createdAt: string };

/**
 * The server merges a duplicate import into the oldest one for the same card
 * and month, tie-broken on id, so following a merge means picking the same one.
 */
export function pickOldestImport<T extends DatedRecord>(
  records: T[],
): T | undefined {
  return records.reduce<T | undefined>((oldest, record) => {
    if (!oldest || isOlder(record, oldest)) {
      return record;
    }
    return oldest;
  }, undefined);
}

function isOlder(candidate: DatedRecord, reference: DatedRecord): boolean {
  const candidateTime = new Date(candidate.createdAt).getTime();
  const referenceTime = new Date(reference.createdAt).getTime();
  if (candidateTime !== referenceTime) {
    return candidateTime < referenceTime;
  }
  return candidate.id < reference.id;
}

const WEB_PROTOCOLS = ['http:', 'https:'];

// `localhost:3000` parses as a URL whose scheme is `localhost:`, so being
// parseable is not enough — the scheme has to be one fetch can reach.
function parseBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`--base-url is not a URL: "${value}"\n${USAGE}`);
  }
  if (!WEB_PROTOCOLS.includes(url.protocol)) {
    throw new Error(
      `--base-url is not a URL: "${value}" (expected http:// or https://)\n${USAGE}`,
    );
  }
  return url.origin;
}
