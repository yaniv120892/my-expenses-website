// IMPORT_API_TOKEN_FILE=<path> npx tsx scripts/statements-due.ts [--sources=<json>] [--base-url=<url>]
//
// Lists the card statements that have closed and are not yet imported,
// grouped by the portal login that reaches them. The sources file names every
// card; it lives outside the repository because it is the household's card
// list.
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { resolveToken } from './lib/apiToken';
import {
  type DueStatement,
  type ImportSummary,
  type UpcomingStatement,
  findDueStatements,
  israelDate,
  parseDueArguments,
  parseStatementSources,
} from './lib/statementSources';

const DEFAULT_SOURCES_PATH = join(homedir(), '.config', 'my-expenses', 'statement-sources.json');

async function main(): Promise<void> {
  const { sourcesPath, baseUrl } = parseDueArguments(process.argv.slice(2), DEFAULT_SOURCES_PATH);
  const sources = parseStatementSources(await readSourcesFile(sourcesPath), sourcesPath);
  const imports = await fetchImports(baseUrl, await resolveToken());
  const today = israelDate(new Date());
  const { due, upcoming } = findDueStatements(sources, imports, today);

  console.log(`Statements due on ${baseUrl} as of ${today}\n`);
  if (due.length === 0) {
    console.log('Nothing due.');
  }
  for (const [login, statements] of groupByLogin(due)) {
    console.log(`${login}:`);
    for (const statement of statements) {
      console.log(`  ${describeDue(statement)}`);
    }
  }

  if (upcoming.length > 0) {
    console.log('\nNext to close:');
    for (const statement of upcoming) {
      console.log(`  ${describeUpcoming(statement)}`);
    }
  }
}

async function readSourcesFile(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    throw new Error(
      `Cannot read the statement sources file ${path} (${error instanceof Error ? error.message : error}); see .claude/skills/collect-statements/SKILL.md for its shape`,
      { cause: error },
    );
  }
}

async function fetchImports(baseUrl: string, token: string): Promise<ImportSummary[]> {
  const response = await fetch(`${baseUrl}/api/imports`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`GET /api/imports failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

function groupByLogin(due: DueStatement[]): Map<string, DueStatement[]> {
  const byLogin = new Map<string, DueStatement[]>();
  for (const statement of due) {
    const statements = byLogin.get(statement.card.login) ?? [];
    statements.push(statement);
    byLogin.set(statement.card.login, statements);
  }
  return byLogin;
}

function describeDue(statement: DueStatement): string {
  const { card, fileName, billingDate, importedBeforeBillingOn } = statement;
  const partial = importedBeforeBillingOn
    ? ` — re-collect: imported ${importedBeforeBillingOn}, before it closed`
    : '';
  return `${fileName}  (${card.holder}, billed ${billingDate})${partial}`;
}

function describeUpcoming({ card, paymentMonth, billingDate }: UpcomingStatement): string {
  return `${billingDate}  ${card.issuer} ${card.last4} ${paymentMonth}  (${card.login})`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
