import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { declaredHandlerOptions } from '@/test/routeDeclarations';
import { filesUnder, isNonTestSource } from '@/test/sourceFiles';

// Every handler an API token can reach, with the scope it needs. Opening a
// route to a token is a decision made here as well as in the route. IMPORTS
// covers what scripts/import-statements.ts calls, the per-row approve the
// collect-statements skill falls back to, and the read-only list. AGENT is the
// MCP endpoint alone; every tool behind it is bound to the token's owner.
const HANDLER_SCOPES = [
  "GET imports/[importId]/reconciliation-preview/route.ts → 'IMPORTS'",
  "GET imports/[importId]/route.ts → 'IMPORTS'",
  "GET imports/route.ts → 'IMPORTS'",
  "POST imports/batch-action/route.ts → 'IMPORTS'",
  "POST imports/process/route.ts → 'IMPORTS'",
  "POST imports/transactions/[importedTransactionId]/approve/route.ts → 'IMPORTS'",
  "POST imports/upload/route.ts → 'IMPORTS'",
  "POST mcp/route.ts → 'AGENT'",
];

const SOURCE_DIR = join(process.cwd(), 'src');
const LITERAL_DECLARATION = /^\s*apiTokenScope: '[A-Z_]+',$/;

const NON_GRANTING_FILES = ['server/http/handler.ts'];

describe('API token scopes', () => {
  it('are declared on exactly the listed handlers', () => {
    expect(declaredHandlerOptions('apiTokenScope')).toEqual([...HANDLER_SCOPES].sort());
  });

  it('are granted only by a literal declaration in a route file', () => {
    const grantsOutsideTheLedger = filesUnder(SOURCE_DIR, isNonTestSource).flatMap((path) => {
      const file = relative(SOURCE_DIR, path);
      if (NON_GRANTING_FILES.includes(file)) {
        return [];
      }
      return readFileSync(path, 'utf8')
        .split('\n')
        .filter((line) => line.includes('apiTokenScope'))
        .filter((line) => !file.endsWith('/route.ts') || !LITERAL_DECLARATION.test(line))
        .map((line) => `${file}: ${line.trim()}`);
    });

    expect(grantsOutsideTheLedger).toEqual([]);
  });
});
