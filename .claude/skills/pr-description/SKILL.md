---
name: pr-description
description: Write the title and body for a pull request in this repository's house style — a required Motivation / Implementation / Proof of Work structure. Use this whenever you are opening a PR, being asked to draft or rewrite a PR description, updating an existing PR body, or writing up a branch's changes for review — including when the user just says "open a PR", "push this and make a PR", or "write up what I changed". Also use it when checking whether an existing PR description is complete before merging.
---

# Writing a PR description

Every PR body in this repository has the same three sections, in this order:
**Motivation**, **Implementation**, **Proof of Work**. Consistency is the
point — a reviewer opening any PR knows where to find why it exists, where
the change lives, and the evidence it works.

The animating idea: the reviewer will read the diff. The description carries
what the diff cannot — the reason, the map, and the proof.

## Gather the facts first — never write from memory of the task

The value of these descriptions is that everything in them is observed.

```bash
git log --oneline main..HEAD          # the commits
git diff main...HEAD --stat            # the real shape of the change
git diff main...HEAD                   # read it — you will find things you forgot
```

Then produce the actual proof. **Read the `proof-of-work` skill and follow
it** — it covers bringing the stack up locally, exercising endpoints, and
capturing screenshots with Playwright. Do that before drafting, so the
Proof of Work section is a transcript rather than a promise.

Check whether the branch relates to earlier work. A cross-reference like
"Companion to #48" or "Third of three fixes from the audit that followed
#39" belongs in the first line of Motivation.

## Title

Sentence case, no prefix, no ticket number, no `feat:`/`fix:`. State the
outcome as a change to the product or the codebase:

- `Let users edit detected subscriptions and see why they were detected`
- `Drill into a pie slice to see its transactions`
- `Render all money through one ILS formatter`
- `Fix transactions list 400 by paginating within the perPage cap`

Prefer the user-visible effect over the mechanism when both fit. A pure
refactor names the shape it moved to, not the effort spent
(`Read the comparison series bound from one constant`, not
`Refactor trends constants`).

## 1. Motivation

Two to three lines. Not a paragraph, and not a restatement of the title.
Say what was wrong or missing and why it was worth fixing — the state of the
world the change lands in.

A good Motivation makes the reader want the change before they know what it
is. Concrete beats abstract: describe the old behaviour precisely enough
that it feels wrong.

```markdown
## Motivation

Someone with four credit cards runs the entire Imports flow four times: open
the dialog, drop one file, wait for the upload and the extraction submit, let
the dialog close, reopen it, repeat. The dropzone was capped at one file and
started the request on drop, which is also why the payment month had to be
typed before dropping.
```

```markdown
## Motivation

Third of three fixes from the client/schema mismatch audit that followed #39.
The subscriptions page showed a `$` on its amounts — the only place in the app
doing so — because the feature built its strings with template literals instead
of the shared formatter. Pulling that thread found four independent definitions
of "money is ILS" that had drifted apart.
```

Do not open with "This PR adds…" or "This pull request implements…".

## 2. Implementation

The map of the change: the main files or areas touched, **one sentence each**
saying what it now does or why it changed. Bullets, with the path in
backticks.

**Skip test files.** Their content belongs in Proof of Work, and listing them
adds length without telling the reviewer anything they cannot see.

Group under a bold sub-label when the change spans distinct areas — server,
client, schema — so the shape is visible at a glance.

```markdown
## Implementation

**Server**

- `src/server/services/subscriptionService.ts` — annual cost is always derived
  from amount + frequency, so page totals cannot drift from the card figures.
- `src/app/api/subscriptions/[id]/route.ts` — new `PATCH` taking name, amount,
  frequency, last charge date, next expected date and category.
- `prisma/schema.prisma` — `userEditedAt` on `DetectedSubscription`, which
  stops the weekly detection run from overwriting user-set fields.

**Client**

- `src/components/subscriptions/SubscriptionCard.tsx` — adds the edit action
  and the category chip.
- `src/hooks/useSubscriptions.ts` — mutation plus cache invalidation for the
  new endpoint.
```

Judgement on granularity: name the files a reviewer should open, not every
file the diff touches. A sweep across twenty call sites is one bullet naming
the pattern, not twenty bullets.

If a bullet needs more than a sentence — a decision that was genuinely
contested, a mechanism with a non-obvious reason — keep the bullet to one
sentence and expand it in an optional section below. Implementation stays
scannable.

## 3. Proof of Work

Evidence the change does what it says, produced by running it. The
`proof-of-work` skill covers how to generate this; what belongs here is the
result:

- **Backend changes** — the service run locally against a real Postgres, the
  relevant endpoint or flow called, and the actual request/response pasted in
  a fenced block. Include the failing case too when the PR fixes a bug: the
  old error and the new success.
- **UI changes** — Playwright screenshots committed under `docs/proof-of-work/`
  and embedded, desktop and mobile, plus dark mode when the change touches
  anything visual.
- **Always** — the check results with real numbers:

```markdown
- `npm test` — 315/315
- `npm run typecheck` — clean
- `npm run lint` — 0 errors (25 warnings, all pre-existing in `src/server/services/`)
```

Say what you did _not_ verify when that is true of anything meaningful — a
screen that was typechecked but never clicked through, a path only covered by
a unit test. That honesty is what makes the rest of the section credible.

## Optional sections, after the three

Add these only when the change genuinely calls for one. They come after
Proof of Work.

| Section                              | Use it when                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `## ⚠️ Behavior change worth a look` | Behaviour changes beyond what the title promises — always call this out loudly              |
| `## A note on the alternative`       | You rejected a real alternative; name it, say why it loses, and invite the counter-argument |
| `## Also fixed`                      | You fixed things found along the way that are not the headline change                       |
| `## Deliberately not done here`      | You consciously stopped somewhere, so the omission reads as a decision                      |
| `## Notes for the reviewer`          | Anything that fits nowhere else                                                             |

The defended alternative is the one most worth writing. From #40:

> Relaxing the schema instead would be a smaller diff, but it would make
> clearing a category a **silent no-op**: Prisma reads `undefined` as "leave
> unchanged", so the old category would survive while the UI implied AI had
> picked a new one. … Happy to switch if you'd rather have the endpoint accept
> clearing.

A reviewer can overrule that in one comment instead of discovering it in the
diff.

## Voice

Plain declarative prose, specific figures, no salesmanship. Write as a
careful engineer explaining their reasoning to a peer who is about to
disagree.

- **Backtick every identifier, use full paths** — `src/server/services/importService.ts`,
  `handleCompletedExtraction`. A reviewer should be able to jump straight to it.
- **Show the artifact, don't describe it** — paste the real error text, the
  two snippets that disagree, the rendered output. A table when several
  things drifted apart.
- **Explain the mechanism, not just the outcome** — "Two upload at a time:
  sequential is as slow as today, and unbounded splits one uplink N ways
  against a 120s wall-clock upload timeout, turning a slow batch into N
  failures."
- **State the limits** — "Rows detected before this change have no evidence
  stored; the dialog says so rather than inventing a reason retroactively."
- No emoji except the ⚠️ marker, no marketing language.

## Length

Match the change. A one-file fix: Motivation of two lines, two or three
Implementation bullets, a short Proof of Work — around 1,000 characters. A
substantial feature runs 4,000–8,000 with grouped Implementation bullets,
screenshots, and two or three optional sections. Padding a small PR into the
big-PR shape wastes the reviewer's time.

## Footer

End the body with the attribution footer, after a rule:

```markdown
---

_Generated by [Claude Code](https://claude.ai/code)_
```

The tooling may append this and strips duplicates, so include it and do not
worry about it appearing twice. Never put a model name, `Co-Authored-By`, or
a session ID in the body.

## Before you post

- Does Motivation make me want the change, in three lines, without the title?
- Can I open every file a reviewer needs from the Implementation bullets?
- Is the Proof of Work something I actually ran, with real numbers?
- Is there a sentence the diff already tells me? Cut it.
- If this changes something beyond what the title promises, is that loud?

## Worked example

`references/example.md` holds a complete body in this structure, annotated
with what each section is doing. Read it when you want a full-shape model.
