# Attribution and the household activity log

Load before adding or changing any write to household data, a system job that creates or updates
rows, `HouseholdActivity`, Settings → Activity, or the "Added by / Edited by" labels.

## Every household write is attributed; nothing is restricted by it

- The seven data models carry `createdById`/`updatedById` (null for system writes and for rows
  older than the columns, whose creator was backfilled from `userId`), stamped by the
  `attributionStamp` Prisma extension (`src/server/db/attribution.ts`) from the actor in
  `src/server/db/actorContext.ts`, which `createHandler` sets for every member request, so no
  write path can skip it.
- The extraction callback, which carries no member, credits its rows to the import's uploader.
- A system job marks the rows it creates `createdBySystem` and leaves a row it updates alone.
- Transactions show "Added by / Edited by", or "Added automatically", in the list, the Pending
  list and the edit dialog.

## The activity log

- Each member-visible change is also appended to `HouseholdActivity` (actor user, API token when
  the write came through one, or the system job; action, entity) through the one helper
  `householdActivityService.record({ actor, write, describe })`.
- `write` runs in an interactive transaction that every repository call made inside it joins —
  the default `prisma` export resolves to that transaction while one is open, and a repository's
  own `$transaction` nests in it — so a change and its record commit together.
- Only database work goes inside `write`: model calls, storage and notifications stay outside,
  since the transaction holds the instance's one connection.
- Membership events (invite created or revoked, joined, left, removed, role changed, and each API
  token a leave or removal revokes, each worded for which it was) are recorded the same way →
  [household-membership.md](household-membership.md), before changing those flows.
- A delete or role change that changes nothing records nothing, and subscription detection
  records only the subscriptions a run creates, so a re-run adds no entry.
- An entry stores only the entity's own words (`summary`: a description, file name, member or
  token name) and a `role`; Settings → Activity (`/settings/activity`,
  `GET /api/household/activity`) words the sentence in the reader's language
  (`src/utils/householdActivityText.ts`) and pages it newest first. It is the only trace of a
  delete.
