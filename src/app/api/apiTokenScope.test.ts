import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_DIR = join(process.cwd(), 'src/app/api');

// Every handler an API token can reach, with the scope it needs. Opening a
// route to a token is a decision made here as well as in the route. IMPORTS
// covers what scripts/import-statements.ts calls, the per-row approve the
// collect-statements skill falls back to, and the read-only list.
const HANDLER_SCOPES = [
  "GET imports/[importId]/reconciliation-preview/route.ts → 'IMPORTS'",
  "GET imports/[importId]/route.ts → 'IMPORTS'",
  "GET imports/route.ts → 'IMPORTS'",
  "POST imports/batch-action/route.ts → 'IMPORTS'",
  "POST imports/process/route.ts → 'IMPORTS'",
  "POST imports/transactions/[importedTransactionId]/approve/route.ts → 'IMPORTS'",
  "POST imports/upload/route.ts → 'IMPORTS'",
];

const SCOPE_DECLARATION = /\bapiTokenScope\s*:\s*([^,\n}]+)/;

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return routeFiles(path);
    }
    return entry.name === 'route.ts' ? [path] : [];
  });
}

function declaredScopes(path: string): string[] {
  const route = relative(API_DIR, path);
  return readFileSync(path, 'utf8')
    .split(/^export const /m)
    .slice(1)
    .flatMap((handler) => {
      const scope = SCOPE_DECLARATION.exec(handler)?.[1].trim();
      const method = handler.slice(0, handler.indexOf(' '));
      return scope ? [`${method} ${route} → ${scope}`] : [];
    });
}

describe('API token scopes', () => {
  it('are declared on exactly the listed handlers', () => {
    const declared = routeFiles(API_DIR).flatMap(declaredScopes).sort();

    expect(declared).toEqual([...HANDLER_SCOPES].sort());
  });
});
