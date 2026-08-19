---
name: proof-of-work
description: Produce real evidence that a change works — bring the app up locally against a real Postgres, exercise the endpoint or flow, and capture Playwright screenshots for UI changes — then write it up for a PR's Proof of Work section. Use this whenever you finish a change and need to show it works, when writing or filling in a PR's Proof of Work section, when asked to "prove it works", "show it working", "test this manually", "take screenshots", or before claiming any change is done. Passing unit tests alone are not proof of work.
---

# Proof of work

A green test suite says the code does what the test expects. Proof of work
says the _feature_ does what the PR claims, in the running app — a real
Postgres, a real HTTP request, a real browser.

The reviewer should be able to read this section and believe the change
without checking out the branch. That means pasted output rather than
description, and honesty about what was not exercised.

Decide what to produce from what the change touches:

| Change touches                   | Produce                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| Server, API route, service, cron | Stack up locally, call the endpoint or flow, paste request/response                |
| UI                               | Playwright screenshots — desktop and mobile, plus dark mode for anything visual    |
| Both                             | Both                                                                               |
| Schema                           | The migration applying, and a query showing the new shape                          |
| Bug fix                          | The failing case reproduced _before_, and the same case succeeding _after_         |
| Tooling, docs, a skill           | No runtime surface — apply it to real inputs from this repo and show what came out |

Every one of them also carries the check results: `npm test`, `npm run
typecheck`, `npm run lint`, with real counts.

## Bringing the stack up

The app's Prisma client runs through Accelerate (`prisma://`), so a local run
needs `prisma dev` rather than a bare Postgres URL. `DIRECT_URL` stays plain
Postgres for migrations, the seed, and Mastra's memory.

```bash
npx prisma dev                      # Prisma Postgres + Accelerate proxy; prints both URLs
npx prisma migrate deploy           # uses DIRECT_URL
```

Then bring up the app. The e2e harness already assembles a full working
environment — a mock OpenAI-compatible model server, an in-process Upstash
REST shim, and a seeded pair of users — so prefer it over hand-assembling env
vars:

```bash
npx tsx test/e2e-api/serve.ts       # stays alive, prints E2E_AUTH_TOKEN
```

That token is a valid `session` JWT for the seeded user A. Use it as
`Authorization: Bearer` for API calls and as the `session` cookie for the
browser — `e2e/helpers.ts` `signIn()` plants it.

Read `test/e2e-api/README.md` for the full environment, including why
`TELEGRAM_BOT_TOKEN` must stay unset locally (with no token the bot code
no-ops instead of opening sockets).

If the change needs data the seed does not create, add it with a short `tsx`
script against `DIRECT_URL` rather than clicking it in by hand — a script is
repeatable and can go in the PR if a reviewer wants to reproduce.

## Backend proof

Call the real endpoint and paste what came back. Keep responses short enough
to read — trim long arrays with an ellipsis and say what you trimmed.

```bash
TOKEN=...   # from serve.ts
curl -s -X PATCH localhost:3000/api/subscriptions/$ID \
  -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"frequency":"MONTHLY","amount":89.9}' | jq
```

What makes it convincing:

- **Show the before as well as the after** when fixing a bug. The old error
  text is the strongest evidence the fix was necessary; without it, the
  reviewer only has your word that anything was broken.
- **Exercise the failure paths you claim to have handled** — the 401, the
  409, the tampered signature, the redelivered webhook. A PR that says "a
  redelivered callback is a no-op" should show the redelivery returning 200
  with no new rows.
- **Prove the negative when the change is about isolation or scoping** — call
  as the other seeded user and show their data absent.
- **For a cron route**, call it with `Authorization: Bearer $CRON_SECRET` and
  show both the 401 without it and the work it did with it.

Annotate the transcript with a line of prose saying what it demonstrates.
A block of curl output with no framing makes the reviewer do the reading.

## UI proof — screenshots

Capture with Playwright against the running app, using the seeded session
rather than logging in through the form each time.

`scripts/capture.ts` in this skill does the standard capture: signs in with
the token, visits a route, and writes desktop (1440×900), mobile (390×844),
and dark variants. Copy it into the repo root or run it in place:

```bash
E2E_AUTH_TOKEN=$TOKEN npx tsx .claude/skills/proof-of-work/scripts/capture.ts \
  --route /subscriptions --name subscriptions-edit --dark
```

Dark mode is set by seeding `localStorage['mui-mode'] = 'dark'` before the
page loads — the theme uses MUI's CSS-vars `colorSchemeSelector: 'data'` with
`InitColorSchemeScript`, so the attribute is applied on first paint and the
screenshot has no light-mode flash.

For a flow rather than a screen — a dialog mid-batch, a chart after a click —
write a short spec in `e2e/` or extend an existing one and screenshot at the
interesting moments. A screenshot of an empty page proves nothing; seed the
data that makes the change visible, and say in the PR what was seeded.

**Where they go.** Commit under `docs/proof-of-work/` with descriptive
kebab-case names carrying the variant: `import-queue-desktop.png`,
`import-queue-mobile.png`, `transactions-desktop-dark.png`.

**How they are embedded.** GitHub does not render a relative image path in a
PR body, so use a raw URL. Pin it to the **commit SHA**, not the branch name —
a branch URL breaks the moment the branch is deleted after merge, which is
exactly when someone reads the PR as history:

```markdown
| Desktop                                                                                                                                      | Mobile                                                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| <img src="https://raw.githubusercontent.com/yaniv120892/my-expenses-website/<sha>/docs/proof-of-work/import-queue-desktop.png" width="600"/> | <img src="https://raw.githubusercontent.com/yaniv120892/my-expenses-website/<sha>/docs/proof-of-work/import-queue-mobile.png" width="250"/> |
```

Push the screenshots first, then read the SHA with `git rev-parse HEAD` and
write the body. Widths of 600 (desktop) and 250 (mobile) keep the table
readable; use 400/200 when putting four variants in one row.

Caption every table with one line saying what the reader is looking at and
what is different about it. "The queue with four rows mid-batch, one failed
and offering Retry" earns its place; a bare screenshot does not.

## When there is nothing to run

A change to tooling, documentation, CI config or a skill has no endpoint and no
screen, which makes it tempting to skip this section. Don't — it is the case
where proof matters most, because nothing else will catch a mistake.

Prove it the same way: **apply the thing to real inputs and show the result.**
For a skill, that means running it against real PRs, commits or files from this
repository and reporting what it produced, including where it fell short. For a
CI change, a run of the workflow. For a script, its output on real data.

Anything mechanically checkable should still be checked and reported — a
Mermaid diagram parsed rather than eyeballed, a bundled script passing
`npm run typecheck` and `npm run lint`, a JSON file validating against its
schema. "It looks right" is not proof of work.

Reporting where it fell short is not optional. A section that only lists
successes is marketing; the reviewer needs to know which cases were tried and
which ones the change does not handle.

## The check results

Always, with real numbers observed on this branch:

```markdown
- `npm test` — 315/315
- `npm run typecheck` — clean
- `npm run lint` — 0 errors (25 warnings, all pre-existing in `src/server/services/`)
```

Add `npm run test:e2e:api` and `npm run test:e2e:ui` with their counts when
the change touches those paths. Note when new tests fail on the old code and
pass on the new one — that is the cheapest way to show a test is meaningful
rather than tautological.

Never write a number you did not see. If a suite was not run, say so.

## Say what you did not verify

The section's credibility comes from its limits. Real examples worth
imitating:

> The subscriptions card and the import-approve form change are typechecked
> and built but not clicked through.

> Because this branches off `main`, the "only `format.ts` builds an `Intl`
> formatter" check cannot pass here — I verified the combined state in a
> scratch worktree by merging #48 into this branch.

Anything that was mocked deserves the same treatment: say which boundary was
stubbed and what still ran for real. "Only the S3 upload is stubbed, in the
browser; everything downstream runs for real" tells the reviewer exactly how
much the evidence is worth.

## Cleaning up

Stop `serve.ts` and `prisma dev` when done. Do not commit the seed scripts,
`.env` files, or Playwright traces — only the screenshots under
`docs/proof-of-work/` belong in the diff.
