import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_DIR = join(process.cwd(), 'src/app/api');

// The whole grant of a one-year bearer: widening it is a decision, so it has
// to be made here as well as in the route.
const ROUTES_ACCEPTING_IMPORT_TOKENS = [
  'imports/[importId]/apply-auto-approve-rules/route.ts',
  'imports/[importId]/reconciliation-preview/route.ts',
  'imports/[importId]/rematch/route.ts',
  'imports/[importId]/route.ts',
  'imports/[importId]/transactions/route.ts',
  'imports/batch-action/route.ts',
  'imports/process/route.ts',
  'imports/route.ts',
  'imports/transactions/[importedTransactionId]/approve/route.ts',
  'imports/transactions/[importedTransactionId]/ignore/route.ts',
  'imports/transactions/[importedTransactionId]/merge/route.ts',
  'imports/transactions/[importedTransactionId]/route.ts',
  'imports/upload/route.ts',
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

describe('import token scope', () => {
  it('is granted on exactly the listed routes', () => {
    const granted = routeFiles(API_DIR)
      .filter((path) =>
        readFileSync(path, 'utf8').includes('acceptsImportToken: true'),
      )
      .map((path) => relative(API_DIR, path))
      .sort();

    expect(granted).toEqual([...ROUTES_ACCEPTING_IMPORT_TOKENS].sort());
  });
});
