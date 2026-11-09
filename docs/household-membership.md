# Household membership

Load before changing invites, `/join`, leaving or removing a member, a role change, Settings →
Share household, or `/api/household/*` (other than the activity log).

How a member's household and role scope every request → [households.md](households.md), before
changing scoping or the write guard.

## A member joins a household only by redeeming an invite, and nothing is merged

- The owner issues invites under Settings → Share household (`/api/household/*`,
  `householdService`, checks in `src/server/services/validators/inviteValidator.ts`): an
  8-character code from an unambiguous alphabet (`src/server/utils/inviteCode.ts`), single use,
  14 days, granting `EDITOR` (the default) or `VIEWER` — never `OWNER`, so a household keeps
  exactly one and ownership is not transferable.
- Every code that cannot be redeemed — unknown, used, revoked, expired — gets the same 404.
- Every household refusal is a `HouseholdRefusal` (`src/server/services/householdRefusal.ts`)
  carrying a `code` from `HOUSEHOLD_ERROR_CODES` (`src/shared/types/household.ts`);
  `createHandler` sends any `HttpError`'s code beside its message (`{error, message, code}`), and
  the client localizes by the code.
- Invite routes take no API token.

## Joining

- `/join?code=` (`src/app/join/`, outside both route groups) previews and confirms; signed out,
  the proxy sends it to `/login?next=`, and login, signup and verify follow only a same-site
  `next` (`src/shared/nextPath.ts`).
- Joining moves the member and drops the household they leave, which is allowed only while it
  holds no other member and no live row (`hasAnythingAJoinWouldOrphan`; a soft-deleted import or
  imported row does not count).
- One transaction claims the invite (guarded on it still being open), hard-deletes those
  soft-deleted rows, and deletes that household, whose restricting foreign keys fail the move if
  it gained anything meanwhile.

## Leaving and removal

- The owner cannot leave or change their own membership.
- A member who leaves, or is removed, gets a fresh empty household as its owner and, in the same
  transaction, loses every API token, since a token follows its user into whatever household they
  are in; removal also bumps their `tokenVersion`, ending every session.

Each of these events is recorded in the activity log →
[household-activity.md](household-activity.md), before changing what a membership change records.

## Tests

`e2e/household.spec.ts` drives the whole flow in a browser with the seed's data-free `hh-*` users
(`test/e2e-api/householdUsers.ts`), which no other spec may use.
