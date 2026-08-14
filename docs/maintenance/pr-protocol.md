# Maintenance routine PR protocol

Shared rules for every routine under `.claude/skills/maintenance-*`. Read this
before doing routine work.

The routines run unattended on a schedule and open PRs a human reviews. That
makes reviewer attention the scarce resource, not agent time. Every rule below
exists to keep the signal-to-noise ratio high enough that the PRs stay worth
reading.

## Before starting: check backpressure

List open PRs whose branch starts with `claude/maint-<routine>-`. **If two or
more are already open, stop and do nothing.** An unreviewed queue means the
routine is producing faster than it is being consumed; adding to it makes the
backlog worse, not the codebase better.

## Do nothing rather than something marginal

If the routine finds nothing worth changing, say so and exit **without opening
a PR**. An empty, speculative, or "here's a small tidy-up while I was in here"
PR trains the reviewer to skim, and a skimmed review is how a real bug lands.
Finding nothing is a valid, common, successful outcome.

## One concern per PR

Each PR changes one thing for one reason. Never bundle an unrelated rename,
formatting sweep, or drive-by fix into a routine PR — a reviewer approving a
dead-code removal must not have to also evaluate a refactor.

## The verification gate

Every routine PR must pass, locally, before it is opened:

```bash
npm run lint && npm run typecheck && npm test
```

If the change can affect what renders or what an endpoint returns, also run the
e2e suites (`npm run test:e2e:api`, `npm run test:e2e:ui`) as set up in
`.github/workflows/ci.yml`. If a gate fails and you cannot fix it cleanly,
abandon the change — do not open the PR.

**Never make a gate pass by weakening it.** No `any`, no `@ts-expect-error`, no
`eslint-disable`, no deleting or skipping a test, no loosening an assertion. If
that is the only way through, the change is wrong.

## Out of bounds

Routines must never touch:

- `prisma/migrations/**` — applied migrations are immutable
- `prisma/schema.prisma` — schema changes need a migration and a human
- `.env*`, secrets, or any credential
- CI workflow permissions or auth configuration
- Dependency version bumps (that is a different job with a different risk
  profile)

## Branch, title, body

- Branch: `claude/maint-<routine>-<yyyymmdd>`
- Title: `chore(maintenance): <routine> — <specific summary>`

**Committing and opening the PR.** Create the branch and commit locally. Then
write the PR title and body to `.maintenance/pr-body.md`, first line the title,
a blank line, then the body:

```
chore(maintenance): dead-code — remove the Sentry error adapter

## What changed
...
```

Do not push and do not open the PR yourself when running under
`.github/workflows/claude-maintenance.yml` — a later workflow step reads that
file, pushes the branch, and opens the PR, so that the PR is attributed
consistently and CI runs on it. When running this routine by hand outside the
workflow, push and open the PR normally.

If there is nothing to change, make no commit and write no
`.maintenance/pr-body.md`. The workflow treats "no commit" as "nothing to do"
and opens nothing.

Body must contain:

- **What changed** and the one reason why
- **Evidence** — the greps, the fuzz seed, the command output that establishes
  the finding is real. A claim with no evidence is a guess
- **Verification** — the gate commands that were run and their result
- **Risk** — what breaks if the reasoning is wrong, and how a reviewer would
  notice

Be honest about uncertainty. "I could not prove this export is unreachable via
the Telegram webhook path" belongs in the body, not omitted to make the PR look
cleaner.

## Tuning beats retrying

When a routine produces a bad PR, the durable fix is to edit that routine's
`SKILL.md` so the next run does better — a constraint it missed, a hunting
ground that is noise, a false-positive pattern to skip. Prefer tuning the
routine over re-running it and hoping.
