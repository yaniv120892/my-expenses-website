---
name: pr-review
description: Use when asked to review one or more pull requests, given PR numbers or URLs to review, or asked whether a PR is safe to merge. Also use when a review must check that CLAUDE.md still matches the code.
---

# Pull Request Review

Reviews a batch of pull requests. One subagent per PR, all in parallel. Every
PR gets a code review, a rules check and a CLAUDE.md drift check. Findings
merge into one report, you approve once, everything posts.

Canonical source: `plugins/pr-workflows/skills/pr-review/` in
yaniv120892/claude-config — edit there, then sync this copy. This copy is
adapted to this repo: the GitHub MCP tools replace `gh` and the Python helpers
(a web session has neither), and the documentation whose drift is checked is
`CLAUDE.md`, this repo's only design document, instead of a Notion tree.

## Step 1 — Require explicit targets

Collect every PR number or URL from the request. Accept several.

**If none were given, STOP and ask which PRs.** Never fall back to the current
branch — it is routinely a different ticket, stale, or stacked under the change
actually being reviewed.

Resolve each target to `owner/repo` + number before dispatching. Resolve the
head SHA and changed-file count yourself (`pull_request_read` with method
`get` and `get_files`) and put them in the prompt — it saves the agent calls and
makes a stall easier to retry.

## Step 2 — Dispatch one subagent per PR, in parallel

Send all `Agent` calls in a **single message** so they run concurrently.
Substitute the repo's absolute path into the prompt — a subagent starts with no
knowledge of where this file lives.

```
Agent({
  description: "Review PR <n>",
  subagent_type: "general-purpose",
  prompt: "Review pull request <owner/repo>#<n> (head <sha>, <k> changed files).

    Read these first, in order:
      <REPO_ROOT>/.claude/skills/pr-review/references/rubric.md
      <REPO_ROOT>/.claude/skills/pr-review/references/docs-alignment.md
    Then read whichever of these match the diff, and skip the rest:
      <REPO_ROOT>/.claude/skills/pr-review/references/backend-review.md
      <REPO_ROOT>/.claude/skills/pr-review/references/nextjs-frontend-review.md
      <REPO_ROOT>/.claude/skills/pr-review/references/code-smells.md

    Follow rubric.md exactly. Do not delegate further. Do not post anything —
    the caller posts after the user approves.

    Budget: at most ~25 tool calls. Fetch the diff ONCE and work from it. Read at
    most 3 surrounding source files. If you are running long, return what you
    have rather than continuing.

    Return the sections rubric.md's output contract specifies and nothing else."
})
```

Do not review inline yourself. The orchestrator never loads the rubric; that is
the point of keeping it in `references/`.

**If an agent stalls or fails**, re-dispatch only that PR with the same prompt.
The others' results still stand — never re-run the whole batch.

## Step 3 — Merge into one report

```markdown
## Review — <N> pull requests

| PR  | Severity | file:line | Issue | Fix |
| --- | -------- | --------- | ----- | --- |
```

One table, sorted HIGH → MEDIUM → LOW across every PR, so the worst thing in
the batch is the first row regardless of which PR it came from. Then:

- **Rule violations** — a separate table. A style violation is not a bug, and
  mixing them buries the bugs.
- **Docs alignment** — per PR: the `CLAUDE.md` section, the sentence the diff
  contradicts, one line on what to update.
- **CI** — per PR: which checks, which commit, green or not. Say plainly when you
  could not verify.
- **Verdict** — one line per PR.

Report faithfully. If a subagent could not verify something, carry that through
to the report rather than smoothing it over.

## Step 4 — One approval for the batch

End with: `Post <N> comments across <M> PRs? (y/n)`

Wait. Nothing posts before an explicit yes.

## Step 5 — Post

On yes, post every finding as an inline comment pinned to its file and line,
never as a general note: `pull_request_review_write` with method `create`
opens a pending review on the head SHA from step 1, `add_comment_to_pending_review`
adds each finding (added line → `RIGHT` side; removed line → `LEFT`), and
`pull_request_review_write` with method `submit_pending` and event `COMMENT`
posts them all at once. A docs-alignment finding is a general note on the PR
(`add_issue_comment`), since it has no line.

Every comment obeys the comment contract in `references/rubric.md`, which is
the single source of truth for comment form — do not restate its rules here.
Every comment ends with the Claude Code attribution footer the session
requires.

## Gotchas

- A review cannot approve its author's own PR; `COMMENT` is the event to use
  for a review of your own branch.
- Docs alignment never edits `CLAUDE.md`. It reports drift; the PR's author
  decides, and `CLAUDE.md` requires the fix to land in the same PR.
