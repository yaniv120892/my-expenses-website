---
name: pr-description
description: Write the title and body for a pull request in this repository's house style. Use this whenever you are opening a PR, being asked to draft or rewrite a PR description, updating an existing PR body, or writing up a branch's changes for review — including when the user just says "open a PR", "push this and make a PR", or "write up what I changed". Also use it when reviewing whether an existing PR description is good enough before merging.
---

# Writing a PR description

## The one idea behind all of this

The reviewer will read the diff. The description exists for everything the
diff cannot show: why the old state was wrong, which alternatives were
rejected and on what grounds, what to look at sceptically, what was
deliberately left out, and evidence that the thing actually runs.

A description that lists the files changed is redundant with the diff and
therefore worthless. Every convention below follows from that.

The house voice is a careful engineer explaining their reasoning to a peer
who is about to disagree with them. Plain declarative prose, specific
figures, no salesmanship, and honest about what is unproven.

## Gather the facts first — never write from memory of the task

Half the value of these descriptions is that the numbers in them are real.
Before drafting:

```bash
git log --oneline main..HEAD          # the commits, and whether they tell a story
git diff main...HEAD --stat            # the real shape of the change
git diff main...HEAD                   # read it — you will find things you forgot
```

Then actually run the checks you are about to claim passed:

```bash
npm test          # note the exact count: "173/173", "309 passed, 30 files"
npm run typecheck
npm run lint      # 0 errors; the ~25 pre-existing warnings in src/server/services/ are known
```

Run `npm run test:e2e:api` / `npm run test:e2e:ui`, or drive the app in a
browser, when the change touches those paths. If you did not verify
something, say so rather than implying you did — several past PRs end with a
sentence naming exactly which screen was typechecked but never clicked
through, and that honesty is the point.

Check whether this branch relates to earlier work (`gh`-style PR search, or
the repo's recent PRs). Cross-references like "Companion to #48" or "Last of
three fixes from the audit that followed #39" orient a reviewer instantly.

## Title

Sentence case, no prefix, no ticket number, no `feat:`/`fix:`. State the
outcome as a change to the product or the codebase, in the imperative or as
a plain statement of the new capability:

- `Let users edit detected subscriptions and see why they were detected`
- `Drill into a pie slice to see its transactions`
- `Render all money through one ILS formatter`
- `Page the transactions list by cursor and aggregate its totals in SQL`
- `Fix transactions list 400 by paginating within the perPage cap`
- `Require a category when editing a transaction`

Prefer the user-visible effect over the mechanism when both fit. A pure
refactor names the shape it moved to, not the effort spent
(`Read the comparison series bound from one constant`, not
`Refactor trends constants`).

## The opening paragraph

No heading. Two to five sentences establishing the situation the change
lands in, before saying what changed. This is the part most descriptions
skip and the part reviewers actually need.

Good openings do one of these:

- **Describe the old behaviour concretely enough to feel wrong.**
  "Someone with four credit cards runs the entire Imports flow four times
  today: open the dialog, drop one file, wait for the upload and the
  extraction submit, let the dialog close, reopen it, repeat."
- **Name where the change came from.** "Started as a pass to remove comments
  that restate the code, then followed the worst offenders into the methods
  that needed the comments in the first place."
- **Place it in a series.** "Companion to #48. That PR moves the React UI
  onto `src/utils/format.ts`; this one does the server-side string builders
  it doesn't reach. Neither alone makes 'one formatter' true — together they
  do."

Never open with "This PR adds…", "This pull request implements…", or a
restatement of the title.

## Sections

Pick the sections this particular change needs — there is no fixed template,
and forcing an empty section is worse than omitting it. `##` for top-level,
`###` only when nesting inside one. These are the ones that recur, roughly
in the order they tend to appear:

| Section | Use it when | Typical headings used |
| --- | --- | --- |
| The problem | Fixing a bug or a bad shape | `## The bug`, `## The problem`, `## Why`, `## Problem` |
| The change | Almost always | `## The fix`, `## What changed`, `## Changes`, or a named heading per feature area |
| Defended decision | You chose between real alternatives | `## Why a second export rather than reusing X`, `## A note on the alternative`, `## Tradeoff`, `## Design decisions worth reviewing` |
| Loud warning | Behaviour changes beyond the stated scope | `## ⚠️ Behavior change worth a look` |
| Drive-by fixes | You fixed things found along the way | `## Also changed`, `## Also fixed`, `## Fixes found while reviewing this` |
| Scope fence | You consciously stopped somewhere | `## Deliberately not done here`, `## Known follow-up, not in this PR`, `## One formatter deliberately left alone` |
| Schema | A Prisma migration is included | `## Schema` |
| Tests | Test work is substantial enough to describe | `## Tests` |
| Evidence | Always | `## Verification` |
| Leftovers | Anything a reviewer should know that fits nowhere | `## Notes`, `## Notes for the reviewer`, `## Notes on the approach` |

For a feature with several distinct parts, replace the generic "What
changed" with one `##` per part named after the part itself — `## Edit the
numbers`, `## Why it was detected`, `## Category`, `## Sorting`. A reviewer
scanning the headings then gets the feature's outline for free.

For a multi-commit cleanup where the commits are the structure, number the
sections and cite the SHAs, e.g. a heading reading
"1. Drop comments the code already says (`a08dae0`)".

## How to write the body

**Prose in paragraphs, not a bullet dump.** Bullets are for enumerating
things that genuinely are a list — call sites touched, independent fixes,
verification results. Reasoning goes in sentences.

**Show the evidence inline.** These descriptions quote the actual artifact:

- The offending code, in a fenced block with the language tag — often two
  snippets side by side to show a disagreement:
  ```ts
  // createTransactionSchema
  categoryId: z.string().uuid().optional()
  // updateTransactionSchema
  categoryId: z.string().uuid()            // ← required
  ```
- The real error text a user or the API produced.
- A table when several things drifted apart, or for before/after figures:

  | Where | `1234.56` rendered as |
  | --- | --- |
  | `src/utils/format.ts` (all UI) | `1,234.50 ₪` |
  | `chatAggregationService.ts` | `₪1,234.50` |

- A blockquote for generated user-facing text the change now produces.

**Backtick every identifier and use full paths** — `src/server/services/
importService.ts`, `handleCompletedExtraction`, `useImportsQuery`. A
reviewer should be able to jump straight to it.

**Explain the mechanism, not just the outcome.** "Two upload at a time:
sequential is as slow as today, and unbounded splits one uplink N ways
against a 120s wall-clock upload timeout, turning a slow batch into N
failures." The number and the reason both matter.

**Defend the choice you made and invite the counter-argument.** When you
rejected an alternative, say what it was, why it loses, and leave the door
open: "Relaxing the schema instead would be a smaller diff, but it would
make clearing a category a **silent no-op** … Happy to switch if you'd
rather have the endpoint accept clearing."

**Flag what you are unsure about rather than burying it.** If the change
alters behaviour outside its headline scope, give it its own ⚠️ section and
explain what now differs. If part of the change is inconsistent with the
rest of the app, say where and point at the follow-up.

**State the limits.** "Rows detected before this change have no evidence
stored; the dialog says so and points at the next detection run rather than
inventing a reason retroactively."

## The Verification section

Near-universal, and specific. Give real numbers, not "tests pass":

```markdown
## Verification

- `npm run lint` — 0 errors (25 warnings, all pre-existing in `src/server/services/`)
- `npm run typecheck` — clean
- `npm test` — 315/315 on this branch
```

Scale it up when the change warrants it — name what the new tests actually
prove ("New tests fail on the old code (3 of 5) and pass on the new one"),
and describe any manual run in terms of what was real about it: "Run
end-to-end against the real app: Next.js on this branch, real Postgres
(`prisma dev`), real HTTP, real browser, and a local SMTP server capturing
what is actually sent." Paste the captured output when it is short and
convincing.

Close with what you did *not* verify, when that is true of anything
meaningful.

## Length

Match the change. A one-file fix with a clear cause is ~1,000 characters and
may need no headings at all. A typical fix or refactor runs 2,000–3,500. A
substantial feature runs 4,000–8,000 with six to eight sections. Padding a
small PR into the big-PR shape is a failure mode — the reviewer's time is
the thing being spent.

## Footer

End every body with the attribution footer, on its own after a rule:

```markdown
---
_Generated by [Claude Code](https://claude.ai/code)_
```

The tooling may append this automatically and strips duplicates, so include
it and do not worry about it appearing twice. Do not put a model name,
`Co-Authored-By`, or a session ID in the body.

## Before you post

Reread the draft as the reviewer:

- Does the first paragraph tell me why this exists, without the title?
- Is there a sentence here that the diff already tells me? Cut it.
- Did I make a judgement call that a reviewer might make differently, and is
  it defended somewhere?
- Are all the numbers real ones I observed?
- If this changes something beyond what the title promises, is that loud?

## Worked examples

`references/examples.md` holds three complete PR bodies from this repo — a
small fix, a mid-size one with a defended alternative, and a large feature —
annotated with what each is doing. Read it when you want a full-shape model
rather than the rules above, especially for a large PR where section
selection is the hard part.
