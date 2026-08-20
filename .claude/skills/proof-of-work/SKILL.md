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

| Change touches                   | Produce                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------ |
| Server, API route, service, cron | Stack up locally, call the endpoint or flow, paste request/response                  |
| UI                               | Playwright screenshots — desktop, plus mobile if it reflows and dark if it recolours |
| Both                             | Both                                                                                 |
| Schema                           | The migration applying, and a query showing the new shape                            |
| Bug fix                          | The failing case reproduced _before_, and the same case succeeding _after_           |
| Tooling, docs, a skill           | No runtime surface — apply it to real inputs from this repo and show what came out   |

Every one of them also carries the check results, with real counts. Run them
as one command: `npm run typecheck && npm run lint && npm test`.

## Bringing the stack up

The app's Prisma client runs through Accelerate (`prisma://`), so a local run
needs `prisma dev` rather than a bare Postgres URL. `DIRECT_URL` stays plain
Postgres for migrations, the seed, and Mastra's memory.

`prisma dev` prints a plain `postgres://` URL to the terminal, which the app's
edge client rejects. The `prisma://` one is in its state file — read both from
there, exactly as `.github/workflows/ci.yml` does:

```bash
npx prisma dev --name pow &
STATE="$HOME/.local/share/prisma-dev-nodejs/pow/server.json"
export DATABASE_URL=$(node -e "console.log(require('$STATE').exports.ppg.url)")
export DIRECT_URL=$(node -e "console.log(require('$STATE').exports.database.connectionString)")
npx prisma migrate deploy           # uses DIRECT_URL
```

Then bring up the app. The e2e harness already assembles a full working
environment — a mock OpenAI-compatible model server, an in-process Upstash
REST shim, a mock extraction agent, and a seeded pair of users — so prefer it
over hand-assembling env vars. Copy the `env:` block from
`.github/workflows/ci.yml` for the rest; it is the maintained list.

```bash
npx tsx test/e2e-api/serve.ts       # stays alive, prints E2E_AUTH_TOKEN
```

`/api/health` returns 200 without touching anything, so it only proves Next is
serving. Use `/api/health/deep` to check the dependencies: until `serve.ts` is
up it returns 503 with `{"checks":{"db":"ok","redis":"fail"}}` because it cannot
reach the Redis shim, and that is the expected failure, not a broken setup.

That token is a valid `session` JWT for the seeded user A. Use it as
`Authorization: Bearer` for API calls and as the `session` cookie for the
browser — `e2e/helpers.ts` `signIn()` plants it.

`serve.ts` and `npm run test:e2e:api` both bind the shim's port, so they cannot
run at once; stop the former before the latter.

Read `test/e2e-api/README.md` for the full environment, including why
`TELEGRAM_BOT_TOKEN` must stay unset locally (with no token the bot code
no-ops instead of opening sockets).

If the change needs data the seed does not create, add it with a short `tsx`
script against `DIRECT_URL` rather than clicking it in by hand — a script is
repeatable and can go in the PR if a reviewer wants to reproduce. The seeded
transactions sit in January and February, so anything about recent months needs
its own rows. Write the script **inside the repo**, not a scratch directory:
`tsx` resolves `@prisma/client` and the `@/` alias from the nearest
`node_modules` and `tsconfig.json`.

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
and dark variants. Run it in place — it shares `signIn()` with `e2e/helpers.ts`,
so a copy elsewhere would not resolve, and would leave an untracked file behind:

```bash
E2E_AUTH_TOKEN=$TOKEN npx tsx .claude/skills/proof-of-work/scripts/capture.ts \
  --route /subscriptions --name subscriptions-edit --dark
```

`--click <selector>` is repeatable and runs before the shot, which is how a
dialog, a tab or an applied filter gets captured without writing a spec:

```bash
... --route /transactions --name filters-applied \
  --click 'button:has-text("Filters")' \
  --click '.MuiChip-root:has-text("Last month")' \
  --click 'button:has-text("Apply")'
```

It settles for 1800ms before shooting so recharts' enter animation lands;
`--settle` raises that for anything slower. If a chart still looks absent in a
capture, count `.recharts-pie-sector` in the DOM before believing it — the
usual cause is a shot taken mid-animation, not a render bug.

Dark mode is set by seeding `localStorage['mui-mode'] = 'dark'` before the
page loads — the theme uses MUI's CSS-vars `colorSchemeSelector: 'data'` with
`InitColorSchemeScript`, so the attribute is applied on first paint and the
screenshot has no light-mode flash.

`--click` covers anything reachable by clicking. Reach for a short spec in
`e2e/` only when the shot needs an assertion or a state the flags cannot
express — a dialog mid-batch, a row after its retry failed. Either way, a
screenshot of an empty page proves nothing: seed the data that makes the
change visible, and say in the PR what was seeded.

**Where they go — never in the PR's own diff.** Screenshots exist to be looked
at once while the PR is open. Committing them alongside the change puts binaries
in the review, and in the tree forever, for a thing nobody opens again after
merge.

They go on `proof-of-work-assets` instead: an orphan branch that shares no
history with `main` and is never merged, holding nothing but images under a
directory named for the PR. Nothing there reaches any diff, and the raw URLs
keep resolving.

Build the commit with plumbing so the working tree is never touched — no
`checkout --orphan`, no `git clean`, nothing to restore afterwards:

```bash
export GIT_INDEX_FILE=$(mktemp)
for f in shots/*.png; do
  sha=$(git hash-object -w "$f")
  git update-index --add --cacheinfo 100644,"$sha","<pr-slug>/$(basename "$f")"
done
TREE=$(git write-tree)
# Omit -p to keep it an orphan; pass -p proof-of-work-assets to extend it.
COMMIT=$(git commit-tree "$TREE" -m "Proof-of-work screenshots for #NN")
unset GIT_INDEX_FILE
git update-ref refs/heads/proof-of-work-assets "$COMMIT"
git push origin proof-of-work-assets
```

Name files in kebab-case carrying the variant — `import-queue-desktop.png`,
`import-queue-mobile-dark.png` — so a reader can tell them apart from the URL.

**You cannot embed them from here — link them, and hand the files over.**
Posting a PR body through this environment's GitHub tooling runs it through a
sanitiser that strips the leading `!` from every image and wraps absolute URLs
in backticks. A rendered image is an automatic outbound fetch, so this is a
deliberate exfiltration guard, not a bug to route around. Verified against all
three syntaxes on a real PR in August 2026 — it is one tool's behaviour, so
re-check it rather than trusting this table if an image ever does render:

| What you write                            | What gets stored                                        |
| ----------------------------------------- | ------------------------------------------------------- |
| `<img src="https://…" width="600"/>`      | `<img width="600"/>` — `src` gone                       |
| `![alt](https://…)`                       | ``![alt](`https://…`)`` — target backticked, image dead |
| `![alt][ref]` + a definition line         | `!` stripped, definition URL backticked                 |
| `![alt](/owner/repo/blob/<sha>/path.png)` | `!` stripped — but **the URL survives intact**          |

So the one thing that works is a **relative link**, which stays clickable:

```markdown
- [Filters dialog — desktop](/<owner>/<repo>/blob/<assets-sha>/<pr-slug>/filters-dialog-desktop.png)
  — one line saying what the reader is looking at and why it matters.
```

Pin it to the assets branch's **commit SHA**, not the branch name: a branch URL
silently starts serving different bytes the next time the branch moves. Read it
with `git rev-parse proof-of-work-assets` after pushing.

Then **send the PNGs to the user** and say plainly that dragging them into the
description is the only way to get them inline — that route uploads to GitHub's
`user-attachments` CDN, which is the proper host anyway and keeps the files out
of the repository entirely. Their call whether it is worth the drag.

Never claim a body "renders" images you have not seen rendered. Read the body
back after posting and check the URLs survived; the API's stored text is the
truth, and a description that looks right in your draft can arrive gutted.

Say in the body that the screenshots are not in the diff and where they live, so
a reviewer looking for them in the file list knows why they are absent.

Caption every link with what the reader is looking at and what is different
about it — as links rather than images, nobody clicks through to "screenshot
3". "The queue with four rows mid-batch, one failed and offering Retry" earns
the click; a bare filename does not.

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

## The check results

Always, with real numbers observed on this branch:

```markdown
- `npm test` — <passed>/<total>
- `npm run typecheck` — clean
- `npm run lint` — <N> errors (<M> warnings, all pre-existing in `<path>`)
```

The placeholders are deliberate: fill them from the run you just did.

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

Stop `serve.ts` and `prisma dev` when done. Nothing from a proof-of-work run
belongs in the PR: not the seed script, not `.env` files, not Playwright traces,
and not the screenshots — those go to the assets branch. `capture.ts` writes to
a gitignored directory for exactly this reason, so the only thing to check is
that `git status` is clean before pushing.
