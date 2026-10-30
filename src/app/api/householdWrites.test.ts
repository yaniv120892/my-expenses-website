import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const API_DIR = join(process.cwd(), 'src/app/api');

// Every mutating member handler a viewer may still call. Anything else that is
// not a GET writes household data and is refused to a viewer by createHandler.
// A handler lands here only when it writes nothing but the caller's own
// account; the MCP endpoint checks each write tool itself.
const VIEWER_CALLABLE_WRITES = [
  "DELETE api-tokens/[tokenId]/route.ts → 'ownAccount'",
  "DELETE user/settings/telegram-link/route.ts → 'ownAccount'",
  "POST announcements/acknowledge/route.ts → 'ownAccount'",
  "POST api-tokens/route.ts → 'ownAccount'",
  "POST chat/route.ts → 'ownAccount'",
  "POST mcp/route.ts → 'perOperation'",
  "POST user/settings/telegram-link/route.ts → 'ownAccount'",
  "POST user/settings/test-monthly-report/route.ts → 'ownAccount'",
  "POST user/settings/test-telegram/route.ts → 'ownAccount'",
  "PUT user/settings/route.ts → 'ownAccount'",
];

const WRITES_DECLARATION = /\bwrites\s*:\s*([^,\n}]+)/;

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return routeFiles(path);
    }
    return entry.name === 'route.ts' ? [path] : [];
  });
}

function declaredWriteTargets(path: string): string[] {
  const route = relative(API_DIR, path);
  return readFileSync(path, 'utf8')
    .split(/^export const /m)
    .slice(1)
    .flatMap((handler) => {
      const target = WRITES_DECLARATION.exec(handler)?.[1]?.trim();
      const method = handler.slice(0, handler.indexOf(' '));
      return target ? [`${method} ${route} → ${target}`] : [];
    });
}

describe('viewer-callable writes', () => {
  it('are declared on exactly the listed handlers', () => {
    const declared = routeFiles(API_DIR).flatMap(declaredWriteTargets).sort();

    expect(declared).toEqual([...VIEWER_CALLABLE_WRITES].sort());
  });
});
