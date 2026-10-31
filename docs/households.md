# Households

Load before writing any repository or service query, any write route, a migration that adds a
model, or a cron that touches user data.

Invites, joining and leaving → [household-membership.md](household-membership.md), before
changing membership. Who wrote a row and the activity log →
[household-activity.md](household-activity.md), before adding a write.

## Households own the data; a member acts in one

- Every user belongs to exactly one `Household` (`User.householdId`) with a `householdRole`
  (`OWNER | EDITOR | VIEWER`); signup opens one with the user as owner. The role has no default,
  so a member written without one fails rather than becoming an owner.
- A trigger (`user_open_own_household`) opens a household for a user inserted without one, as code
  predating households does, and `row_inherit_household` fills an owned row's `householdId` from
  its `userId` for code predating scoping; both go once no such deployment can serve.
- A session or API-token route's handler receives `actor` (`MemberActor`,
  `src/server/auth/householdActor.types.ts`: user, `HouseholdId`, role, API token), which
  `resolveAuth` loads from the user's row on every request — never from the JWT — so a role change
  or removal applies at once; an API token follows its user into their current household.
- `HouseholdId` is a branded string made only by `toHouseholdId`, so a user id cannot stand in for
  one unconverted.

## The write guard

The one write guard is `assertCanWrite` (`src/server/auth/householdActor.ts`): `createHandler`
calls it before any non-GET member handler, ahead of body parsing and rate limits, unless the
route declares `writes: 'ownAccount'` (it changes only the caller's own settings, tokens or chat)
or `'perOperation'` (the MCP endpoint, where `registerSafeTool` calls it for every tool not
annotated `readOnlyHint`). Which handlers declare either is pinned in
`src/app/api/householdWrites.test.ts`. A viewer is refused with 403; the client hides write
controls from one through `useCanWrite` (`src/hooks/useSession.ts`, the role from
`/api/auth/me`), which only spares a click.

## Every household-owned row is read and written by `householdId`

- The models whose `IS_HOUSEHOLD_OWNED` entry is true (`src/server/db/householdScope.ts`) carry a
  required `householdId`, and their uniques and indexes lead with it.
- Repositories take the `HouseholdId` as their first argument; services take it for reads and the
  actor (`HouseholdActor`, member or system) for writes.
- `userId` on those rows only records which member wrote it — null for a cron's write
  (`systemActor`) or once the member is deleted — and never scopes a query.
- The default `prisma` client enforces this at runtime: a query on one of those models whose
  `where` (directly, in a compound unique key, or in an `AND`) does not name one household as a
  plain value, or a create without one, throws `UnscopedHouseholdQueryError`. It checks only the
  queried model's own arguments, so owned rows are reached through their own model, never a
  nested relation read or write or raw SQL.
- `systemPrisma` skips the check, for the jobs that work across households (the cron sweeps, the
  extraction callback finding its import), and only `crossHouseholdRepository` imports it; that,
  and that the owned-model list matches every schema model with a `householdId` column, are
  pinned in `src/server/db/householdScope.test.ts`.

## Assistant, crons and notifications

- The assistant reads the household from its request context (`HOUSEHOLD_ID_CONTEXT_KEY`), while
  its chat thread stays per member.
- Crons run per household (subscription detection, backup) or per opted-in member over their own
  household (daily summary, monthly report, subscription audit).
- A new transaction is announced to every member who opted in.

## Leak guard

`test/e2e-api/run.ts`'s household leak guard aims every household route at another household's
ids and checks each answers as if the row did not exist and leaves that household's rows
unchanged.
