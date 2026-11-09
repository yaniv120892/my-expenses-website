# Auth and API tokens

Load before changing sign-in, signup or verification, password reset or change, sessions, logout,
a route's `auth` or `apiTokenScope`, or the API-token model.

## Sessions

JWT (jose HS256, 7d) in an httpOnly `session` cookie (`src/server/auth/`). Redis key
`session:<userId>:<token>` must exist (logout deletes it), every token carries a random `jti`, so no
two are equal, and the JWT's `tokenVersion` must equal
the user's (a token signed before versions is 0), so bumping `User.tokenVersion` refuses every
session's API calls at once.

The proxy and `pageViewLayout` check only the signature, so a revoked session still loads a page
shell whose data calls fail, and API tokens are revoked on their own.

## A password is chosen only by whoever reads the mailbox

- A signup (`/api/auth/signup`) takes no password — anyone can send one for someone else's
  address — and creates a pending account with an unusable one. It mails a 6-digit code; up to
  three stay live (`MAX_PENDING_CODES`), so a stranger's signup does not void the owner's, and all
  share one attempts counter that a signup never resets and a wrong guess never burns.
- `/api/auth/verify` takes the code _and_ the password, which becomes the account's; the signup
  page keeps the password in memory and sends it there, and the mailed link's `/verify` page asks
  for it.
- Forgot password (`/api/auth/password-reset/request`) answers `{success: true}` whatever the
  address, mailing a verified account a `/reset-password#token=…` link — 32 random bytes in the
  fragment, so no request log or Referer carries it, on a page the proxy serves signed in or out so
  a browser holding a session keeps the link — stored only as its SHA-256 for 30 minutes, taken
  with one GETDEL by `/confirm`, and honoured only while `passwordResetFor:<userId>` still names
  it, so the next request supersedes it even when two race. A reset mail that fails to send is
  reported and answered as sent, since a 503 only a registered address could get would reveal it.
- Change password (`PUT /api/auth/password`, session only, five tries per user per 15 minutes)
  needs the current one.
- A reset or change ends every session of the user by bumping `tokenVersion` in the same write as
  the hash (`userRepository.updatePassword`) and voids an outstanding reset link; a change then
  issues the caller a fresh session at the new version. A login signs the version it read beside
  the hash, so a reset racing its compare leaves it a refused session.
- A reset also deletes every API token, being account recovery; a change keeps them.

## Bearer and cron callers

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
