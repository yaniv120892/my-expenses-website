# Auth and API tokens

Load before changing sign-in, sessions, logout, a route's `auth` or `apiTokenScope`, or the
API-token model.

## Sessions

JWT (jose HS256, 7d) in an httpOnly `session` cookie (`src/server/auth/`). Redis key
`session:<userId>:<token>` must exist (logout deletes it), and the JWT's `tokenVersion` must equal
the user's (a token signed before versions is 0), so bumping `User.tokenVersion` refuses every
session's API calls at once.

The proxy and `pageViewLayout` check only the signature, so a revoked session still loads a page
shell whose data calls fail, and API tokens are revoked on their own.

API routes also accept `Authorization: Bearer` (scripts/e2e). Cron routes require
`Authorization: Bearer ${CRON_SECRET}`; Vercel sends it automatically.

## API tokens

An **API token** (`mxk_…`, created and revoked in Settings, one year, only its SHA-256 stored in
`ApiToken`) is a bearer for scripts, carrying a list of scopes (`ApiTokenScope`).

- It is read from the `Authorization` header only, never the cookie, and ends in an HMAC keyed by
  `JWT_SECRET`, so a forged one is refused before any database lookup — rotating that secret
  revokes every token along with every session.
- A request made with a token logs its `apiTokenId`.
- A route opts in by declaring the one scope it needs, `apiTokenScope: 'IMPORTS'` on an
  `auth: 'session'` route; a token without that scope gets 403, and every `auth: 'session'` route
  that declares none answers 401 `API_TOKEN_NOT_ACCEPTED` — `/api/api-tokens` included, so a token
  cannot mint another.
- Which handler needs which scope is pinned in `src/app/api/apiTokenScope.test.ts`; a new scope is
  a new enum value plus the routes it opens.
- A scope names a whole capability, not a read/write half: `IMPORTS` drives the import workflow
  end to end (list, upload, preview, approve).
- A session cookie on the same request wins.
- An `auth: 'apiToken'` route takes only an API token — a cookie or session JWT is refused with 401
  `API_TOKEN_REQUIRED` — and must declare its scope. `/api/mcp` is one →
  [personal-agent-mcp.md](personal-agent-mcp.md), before changing the agent's token or refusals.

A token acts in its user's current household → [households.md](households.md), before changing
how a request's actor is resolved.
