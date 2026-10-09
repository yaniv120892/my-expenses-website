import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_DIR = join(process.cwd(), 'src/app/api');

// The whole grant of a one-year bearer: what scripts/import-statements.ts
// calls, the per-row approve the collect-statements skill falls back to, and
// the read-only list. Widening it is a decision made here as well as in the
// route.
const HANDLERS_ACCEPTING_IMPORT_TOKENS = [
  'GET imports/[importId]/reconciliation-preview/route.ts',
  'GET imports/[importId]/route.ts',
  'GET imports/route.ts',
  'POST imports/batch-action/route.ts',
  'POST imports/process/route.ts',
  'POST imports/transactions/[importedTransactionId]/approve/route.ts',
  'POST imports/upload/route.ts',
];

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return routeFiles(path);
    }
    return entry.name === 'route.ts' ? [path] : [];
  });
}

function handlersAcceptingImportTokens(path: string): string[] {
  const route = relative(API_DIR, path);
  return readFileSync(path, 'utf8')
    .split(/^export const /m)
    .slice(1)
    .filter((handler) => handler.includes('acceptsImportToken: true'))
    .map((handler) => `${handler.slice(0, handler.indexOf(' '))} ${route}`);
}

describe('import token scope', () => {
  it('is granted on exactly the listed handlers', () => {
    const granted = routeFiles(API_DIR)
      .flatMap(handlersAcceptingImportTokens)
      .sort();

    expect(granted).toEqual([...HANDLERS_ACCEPTING_IMPORT_TOKENS].sort());
  });
});
