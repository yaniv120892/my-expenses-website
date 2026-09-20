# Review Rubric

Read by the per-PR review subagent. Follow it in order.

Be rigorous and skeptical. Verify with evidence — never assert something passes
without inspecting it. If you cannot verify something, say so and say why.

**Verification depth scales with what you are about to assert, not with a call
budget.** Claiming a HIGH earns whatever reading it takes to be sure — including
a dependency's own source in `node_modules` when the behaviour in question is
the library's. Confirming something routine earns the cheapest check that
settles it, and then you stop. Apply this wherever the rubric asks you to
verify; it is the rule, and the steps below do not restate it.

## 1. Review the actual head, not the local branch

`pull_request_read` with method `get` gives title, author, state, branches and
the head SHA; method `get_diff` gives the diff. Skip `get` if the caller already
handed you the head SHA.

For exact line numbers — needed for inline comments — read files **at HEAD**,
not from your working tree, which is usually a different commit.

With a local clone of the repo (faster, and the default when one exists):

```bash
git fetch origin pull/<n>/head && git show 'FETCH_HEAD:<PATH>' | cat -n
```

**Single-quote the whole `FETCH_HEAD:<PATH>` argument.** Next.js route folders
like `src/app/api/imports/[importId]/route.ts` are a shell glob — unquoted, the
shell expands it to nothing and the command silently no-ops instead of erroring.

Without one: `get_file_contents` with `sha` set to the head SHA.

## 2. Read real context, not just hunks

For every changed file, open the surrounding module, its callers, and any
co-located tests. A hunk in isolation hides the contract, lifecycle, and
concurrency problems that matter most.

## 3. Rules (highest priority, reported separately)

Read the repo's `CLAUDE.md` and `.claude/rules/*` — the craft rules are vendored
there, so a web session needs nothing from `~/.claude`. Cite `file:line`. Keep
these in a section **separate** from correctness findings.

The ones that recur most:

- **Always use braces** for control flow — no braceless guards or early returns.
- **No `as` casts** — narrow via type guards. (`as unknown as T` only to bridge genuinely incompatible types.)
- **Explicit class access modifiers** on every member.
- **`T[]` not `Array<T>`**; **no abbreviated identifiers** (`cfg`, `ctx`, `acc`, `res`…); **`switch` over `else if` chains** on one value.
- **Self-documenting code** — comments only for genuinely non-obvious _why_; extract well-named helpers instead.
- **Public-first method ordering**, unless the repo's lint enforces `no-use-before-define`, which wins for free functions.
- **Avoid `Pick<T,'one'>`** for 1–3 static fields — inline `{ field: T }` or a named type.
- **Types**: exported/shared types in a `types` file; file-local types at the top of the file.
- **Fix lint, don't suppress** — no `eslint-disable` unless genuinely unavoidable.
- **Every new env var has a default** and appears in `.env.example`; a network client is built through `lazy()` and reads env at call time, never at import.
- **Conventional commit title.** Where `feat`/`fix` trigger a release and `chore` does not, a shippable change titled `chore` is a bug — it should be `fix`.

## 4. Correctness — ranked HIGH / MEDIUM / LOW

Be adversarial: hunt for the case that breaks. Apply the sections matching the
stack you actually found; skip the rest rather than padding the report.

### Always

- **Fail fast, don't propagate.** Invalid or unexpected state is guarded at the boundary and thrown immediately — not passed downstream to fail somewhere confusing, nor silently swallowed. Flag catch-and-continue, sentinel/`null` returns that defer a failure, and `?? <fallback>` masking a state that should throw.
- **Assertion helpers over inline throw-guards.** `assertExists(x)` over a raw `if (!x) { throw }` — it encapsulates the check and narrows the type.
- **Error handling**: user-facing errors surfaced with actionable messages, not swallowed. A path that catches and returns a fallback calls `reportSwallowedError`, not `logger.error`.
- **Security**: no secrets in code or client bundles, input validated at the boundary, no injection via string-built queries or commands.

### Frontend (React / Next.js)

- Hooks rules; **dependency arrays** complete and honest — no silenced `exhaustive-deps`.
- **Stale closures** over props/state captured in effects, callbacks, timers, async handlers.
- Re-renders: inline object/array/function props to memoized children; `useMemo`/`useCallback` where it actually changes referential identity, not cargo-culted.
- **`key`** stable and unique — never an array index for reorderable lists.
- **Effect cleanup**: subscriptions, timers, aborts, listeners torn down; no setState-after-unmount.
- Server/client boundary: `"use client"` placement, no server-only code or secrets reaching the client.
- Data fetching: correct query keys, **cache invalidation** after mutations, loading/error/empty states, optimistic updates that roll back, requests cancelled on unmount or arg change.
- Accessibility: labels tied to inputs, semantic roles, keyboard operability, focus management in modals.
- Styling: MUI `sx` and theme tokens only — no inline `style=`, CSS custom properties, or hardcoded hex.

### Backend / services

- Transaction boundaries and partial-failure behaviour; retries idempotent.
- N+1 queries, missing indexes, unbounded result sets.
- Concurrency: races on shared state, missing locks, non-atomic read-modify-write.
- Backwards compatibility of API and schema changes; migration safety on a live table.
- **Shared resolver / mapper / formatter edits.** A PR scoped to one provider can silently re-map every other caller through a function they share. Establish the full caller set before accepting the change, and name that set in the finding.
- **Renamed emitted identifier values** — metric labels, log field values, event names, enum strings crossing a process boundary. Nothing fails to compile; the dashboard, alert rule, or downstream query just stops matching after deploy. Treat renaming an existing series as a breaking change needing its own migration.
- **Every per-row model call is bounded** by `AI_REQUEST_LIMITS`; every route is built with `createHandler` unless `CLAUDE.md` lists it as special.

### Test gap (do this explicitly)

Does a test exercise the behaviour this diff _changes_, or only assert what was
already true? A change that could be reverted with every test still green is a
**HIGH** finding.

### CI hygiene

Review `.github/workflows/ci.yml` and `scripts/dev-local.sh` when the diff
touches either — `CLAUDE.md` says their env blocks are copies of each other, so
a var added to one and not the other is a finding.

## 5. Simplification

Redundant or dead guards, duplicated predicates, collapsible conditions. Dead
config: a directive the surrounding settings make inert. Footguns for the next
change: parallel helpers that must be kept in sync, missing single source of
truth, hardcoded values that should be derived.

These have **no section of their own** — file them into section A at LOW unless
the dead code hides a real bug, which makes it a correctness finding at its
real severity.

## 6. Documentation drift

Run the check in `docs-alignment.md` and carry its output into section C below.

## 7. CI is the authority

`pull_request_read` with method `get_check_runs` lists every check on the head
commit with its conclusion. Confirm the lint/typecheck/test/build job and both
e2e jobs are green **and** that they ran on the head commit you reviewed (the
check run's `head_sha` equals the SHA from step 1). A local build needs a
database and mock services a reviewer doesn't have, so CI decides. If CI is red
or stale, say so; never vouch for what CI has not run.

## Comment contract

Every finding is written as the comment that will be posted. Reviewers skim.

- **Two sentences, maximum.** Problem, then fix.
- **Lead with the consequence**, not a restatement of the diff.
- **Where the fix is code, emit a GitHub suggestion block** so the author commits it in one click. Anchor the comment to the exact line the block replaces.
- **No preamble, no praise, no hedging.** Not "Consider possibly…", not "Great work, but…".

````
Unbounded — `findMany` with no `take` scans the whole table as users grow.

```suggestion
    const rows = await prisma.transaction.findMany({ where, take: 100 });
```
````

A suggestion block that deletes a line is an **empty** ` ```suggestion ` block —
that is correct GitHub syntax, not a mistake.

If you cannot state a concrete fix, the finding is a question, not a comment —
put it under Questions instead.

## Output contract

Return exactly the sections below, nothing else. No summary of the PR's
purpose, no restatement of what the diff does.

A fenced block cannot live inside a table cell — it renders as literal `\n` and
`<br>`. So the table carries the prose sentence only, and any finding with a
code fix gets an `A1`, `A2`… tag whose suggestion block follows **below** the
table. Tag only the findings that have one.

````markdown
### A. Correctness — <owner/repo>#<n>

| tag | severity | file:line | comment (comment-contract form) |
| A1 | HIGH | src/x.ts:42 | Unbounded — `findMany` with no `take` scans the whole table as users grow. |

**A1** — src/x.ts:42

```suggestion
    const rows = await prisma.transaction.findMany({ where, take: 100 });
```

### B. Rule violations — <owner/repo>#<n>

| rule | file:line | comment |

### C. Docs alignment — <owner/repo>#<n>

| CLAUDE.md section | what the diff contradicts | what to update |

### D. CI — <owner/repo>#<n>

<check names, head SHA, pass/fail — or why you could not verify>

### E. Verdict

<one line>

### F. Questions

<only findings with no concrete fix; omit the section if empty>
````

Empty section → write `None`. Never pad a section to look thorough.
