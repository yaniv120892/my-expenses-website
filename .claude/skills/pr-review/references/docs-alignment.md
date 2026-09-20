# Documentation Alignment Check

Does `CLAUDE.md` still describe the system after this diff lands? Read-only —
this check **never edits `CLAUDE.md`**; the finding tells the author what to
change, and `CLAUDE.md`'s own Documentation section requires the change in the
same PR.

## How to check

`CLAUDE.md` at the repo root is the one design document. Read its headings at
review time rather than a list kept here; every section states rules a diff
can falsify.

1. **Name the subsystem from the diff** — a route, service, invariant, cron,
   model, or env var. Not the file names.

2. **Grep `CLAUDE.md` for that subsystem** — the function or file names it
   cites, the env var, the route path. One or two greps per subsystem.

3. **Read the sentences around each hit** and compare each claim against the
   diff. Drift is a _specific sentence, table row, or command line_ that the
   diff makes false.

## What counts as drift

Report only when `CLAUDE.md` states something the diff makes **wrong**:

- A named function, file, env var, route, cron or command that the diff renames,
  moves or removes.
- A documented flow whose steps the diff reorders, removes, or short-circuits.
- A stated constraint ("`COMPLETED` always means every row's match is decided",
  "only production is bare") the diff violates.
- A list the diff adds to or removes from: models, crons, special routes,
  commands.

## What does not count

Do not report these. They generate noise and get the whole section ignored:

- `CLAUDE.md` simply does not mention the change. Absence is not drift — a
  change that fits no existing section and is not a rule future work must
  follow does not belong there, by that file's own terms.
- Wording you would phrase differently.
- Internal implementation detail a bullet deliberately abstracts over.

## Output

One row per drifted section, into section C of the review:

| CLAUDE.md section                | what the diff contradicts                                                            | what to update                         |
| -------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------- |
| Key invariants → Import matching | "±5 days" — `matchWindow` at `src/server/utils/transactionMatching.ts:12` now uses 7 | Amend the bullet, or the diff is wrong |

Quote the stale claim verbatim so the reader can find it in the file.

Pick exactly one closing line, by this test:

| You found                                                                   | Write                                                                                                |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| A section covering the subsystem, nothing in it contradicted                | `None` — name the section and the one thing it does claim, so the reader knows you read it           |
| A section covering the subsystem at a higher altitude than the diff touches | `None` — same. A bullet that abstracts over the detail you changed is working as intended, not a gap |
| No section mentions the subsystem anywhere                                  | `No section covers <subsystem>`                                                                      |
