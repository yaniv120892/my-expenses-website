# Claude maintenance routines

Three routines run on a schedule, each one doing a chore that has a cheap,
mechanical answer to "did this work?", and each one opening at most one PR per
run for a human to review.

| Routine       | Skill                                    | What it does                                                     |
| ------------- | ---------------------------------------- | ---------------------------------------------------------------- |
| `dead-code`   | `.claude/skills/maintenance-dead-code`   | Removes provably unreachable code, orphaned files, unused deps   |
| `dup-unifier` | `.claude/skills/maintenance-dup-unifier` | Unifies similar-but-divergent abstractions, or reports the drift |
| `crash-fuzz`  | `.claude/skills/maintenance-crash-fuzz`  | Fuzzes the UI for crashes and 5xx, then fixes one                |

`.github/workflows/claude-maintenance.yml` runs all three weekdays at 05:00
UTC, and on demand via **Actions → Claude maintenance → Run workflow** (pick a
single routine there to try one in isolation).

Shared rules live in [`pr-protocol.md`](./pr-protocol.md): backpressure, the
verification gate, what is out of bounds, and how a routine hands its commit to
the workflow.

## Why these three

Each routine's output is checkable without judgement about the product: the app
crashed or it didn't, the symbol is referenced or it isn't, the two copies agree
or they don't. That is what makes them safe to run unattended — a wrong PR
costs a review click, not a rollback. Routines that need product judgement
("improve the dashboard") do not belong here.

## Setup

Repository secrets:

- `ANTHROPIC_API_KEY` — required. For a Claude subscription instead, swap the
  `anthropic_api_key` line in the workflow for
  `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` and store
  a token from `claude setup-token`.
- `MAINTENANCE_PR_TOKEN` — optional, strongly recommended. A PAT with `repo`
  scope. GitHub does not run workflows on PRs opened with the default
  `GITHUB_TOKEN`, so without this the maintenance PRs arrive with no CI, which
  removes most of the safety net.

The Claude GitHub App must be installed on the repository.

## The crash fuzzer

`e2e/fuzz/crash-fuzz.ts` signs in with the e2e session cookie and taps around
the eight authenticated pages at random, recording:

- `pageerror` — uncaught exceptions
- `http5xx` — same-origin server errors
- `blank-screen` — the page rendering nothing after an action
- `console` — same-origin console errors
- `dialog` — unexpected native dialogs

Every run is driven by a seeded PRNG, and each finding carries the seed plus
the last 15 actions that produced it, so findings replay:

```bash
# with the e2e stack up and E2E_AUTH_TOKEN exported — see test/e2e-api/README.md
npm run fuzz:crash -- --steps 300 --seed 20260814 --max-minutes 10
```

Flags: `--steps`, `--seed`, `--max-minutes` (wall-clock stop, since one step
can stall), `--out`, `--fail-on-findings`. Findings go to `fuzz-findings.json`,
which is gitignored.

It deliberately skips the Next.js dev-tools overlay (which renders into a
`<nextjs-portal>` shadow root) while still reaching MUI drawers, dialogs and
menus (which render into body-level portals) — scoping the crawl to `<main>`
would miss most of the app's interactive surface.

The fuzzer is not wired into `npm run test:e2e:ui`. A fuzz finding is a lead to
triage, not a red build.

## Tuning

When a routine opens a bad PR, edit that routine's `SKILL.md` rather than
re-running and hoping — a missing constraint, a hunting ground that is all
noise, a false-positive pattern to skip. The routines are meant to get sharper
over time; that only happens if the tuning is written down.

The fuzzer has its own version of this trap. Widening `IGNORED_CONSOLE` or
`isFuzzable` in `crash-fuzz.ts` is how a fuzzer gets quietly switched off, so
any PR that widens a filter has to say which class of real bug the filter could
now hide.
