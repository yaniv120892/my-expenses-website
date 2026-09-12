/**
 * The pure parts of `scripts/import-statements.ts`, kept apart from the script
 * so they can be unit tested: the script runs on import.
 */
import { basename, extname } from 'path';

export type ImportArguments = {
  directory: string;
  dryRun: boolean;
  baseUrl: string;
  // Upload every file again even when the manifest records an import for it.
  resubmit: boolean;
};

export type ParsedStatementName = {
  cardLastFour: string;
  paymentMonth: string;
};

export const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';

const USAGE =
  'Usage: tsx scripts/import-statements.ts <dir> [--dry-run] [--resubmit] [--base-url=<url>]';
const DRY_RUN_FLAG = '--dry-run';
const RESUBMIT_FLAG = '--resubmit';
const BASE_URL_FLAG = '--base-url=';
const STATEMENT_NAME_PATTERN = /^(.+)-(\d{4})-(\d{2})-(\d{4})$/;

export function parseImportArguments(args: string[]): ImportArguments {
  let directory: string | undefined;
  let dryRun = false;
  let resubmit = false;
  let baseUrl = DEFAULT_BASE_URL;

  for (const arg of args) {
    if (arg === DRY_RUN_FLAG) {
      dryRun = true;
      continue;
    }
    if (arg === RESUBMIT_FLAG) {
      resubmit = true;
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

  return { directory, dryRun, baseUrl, resubmit };
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

export type PlanTotals = { merge: number; create: number };

/** The question asked before a commit, and what answer counts as yes. */
export type CommitConfirmation = {
  prompt: string;
  accepts: (answer: string) => boolean;
};

const LOCAL_HOSTS = ['127.0.0.1', 'localhost', '::1', '[::1]'];

export function isLocalTarget(baseUrl: string): boolean {
  return LOCAL_HOSTS.includes(new URL(baseUrl).hostname);
}

/**
 * A local target takes `y`. Anything else is a real site whose rows cannot be
 * un-approved, so the answer has to be its hostname — a typo'd flag several
 * minutes earlier must not be the only thing between a preview and the write.
 */
export function commitConfirmation(
  baseUrl: string,
  totals: PlanTotals,
): CommitConfirmation {
  const summary = `Apply ${totals.merge} merge(s) and ${totals.create} create(s) to ${baseUrl}?`;
  if (isLocalTarget(baseUrl)) {
    return {
      prompt: `\n${summary} [y/N] `,
      accepts: (answer) => answer.trim().toLowerCase() === 'y',
    };
  }

  const { hostname } = new URL(baseUrl);
  return {
    prompt: `\n${summary}\nThis is not a local target. Type its hostname (${hostname}) to confirm, anything else to abort: `,
    accepts: (answer) => answer.trim() === hostname,
  };
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
