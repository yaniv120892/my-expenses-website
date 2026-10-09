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

const SOURCE_DIR = join(process.cwd(), 'src');
const LITERAL_DECLARATION = /^\s*apiTokenScope: '[A-Z_]+',$/;

// Files that name apiTokenScope without granting one: its definition, and the
// type test that checks which handler arms may declare it.
const NON_GRANTING_FILES = ['server/http/handler.ts'];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === 'generated' ? [] : sourceFiles(path);
    }
    const isSource = /\.tsx?$/.test(entry.name);
    const isTest = /\.test(-d)?\.tsx?$/.test(entry.name);
    return isSource && !isTest ? [path] : [];
  });
}

describe('API token scopes', () => {
  it('are declared on exactly the listed handlers', () => {
    const declared = routeFiles(API_DIR).flatMap(declaredScopes).sort();

    expect(declared).toEqual([...HANDLER_SCOPES].sort());
  });

  it('are granted only by a literal declaration in a route file', () => {
    const grantsOutsideTheLedger = sourceFiles(SOURCE_DIR).flatMap((path) => {
      const file = relative(SOURCE_DIR, path);
      if (NON_GRANTING_FILES.includes(file)) {
        return [];
      }
      return readFileSync(path, 'utf8')
        .split('\n')
        .filter((line) => line.includes('apiTokenScope'))
        .filter(
          (line) =>
            !file.endsWith('/route.ts') || !LITERAL_DECLARATION.test(line),
        )
        .map((line) => `${file}: ${line.trim()}`);
    });

    expect(grantsOutsideTheLedger).toEqual([]);
  });
});
