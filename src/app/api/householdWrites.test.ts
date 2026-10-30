import { describe, expect, it } from 'vitest';
import { declaredHandlerOptions } from '@/test/routeDeclarations';

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
  "POST household/join/route.ts → 'ownAccount'",
  "POST household/leave/route.ts → 'ownAccount'",
  "POST mcp/route.ts → 'perOperation'",
  "POST user/settings/telegram-link/route.ts → 'ownAccount'",
  "POST user/settings/test-monthly-report/route.ts → 'ownAccount'",
  "POST user/settings/test-telegram/route.ts → 'ownAccount'",
  "PUT user/settings/route.ts → 'ownAccount'",
];

describe('viewer-callable writes', () => {
  it('are declared on exactly the listed handlers', () => {
    expect(declaredHandlerOptions('writes')).toEqual([...VIEWER_CALLABLE_WRITES].sort());
  });
});
