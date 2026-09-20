---
name: prune-comments
description: Use when asked to remove redundant comments, "de-comment", clean up comment noise, or enforce self-documenting code on a diff, file, directory, or PR. Also run as part of a pre-merge cleanup pass. Deletes comments that restate the code and renames what they were compensating for.
---

# Prune Comments

Delete every comment the code can carry itself, and rename whatever the comment was
propping up. Comments go stale; names do not.

Canonical source: `plugins/dev-workflows/skills/prune-comments/` in
yaniv120892/claude-config — edit there, then sync this copy. This copy points at
the rules vendored into this repo, since a web session has no `~/.claude`.

The governing rule is **Self-Documenting Code Over Comments** in
`.claude/rules/code.md`. Read that file — do not work from memory of it.
`CLAUDE.md` adds this repo's own bar: comments only where code cannot explain
itself, 1–2 sentences max.

## Scope

Default to the current diff: `git diff @{upstream}...HEAD`, falling back to
`git diff origin/main...HEAD` then `git diff HEAD~1`. If there are uncommitted
changes or the range is empty, include `git diff HEAD`.

An explicit argument overrides the default — a PR number (its diff through the
GitHub MCP tools, or `git fetch origin pull/<n>/head`), a branch, a file, or a
directory. **Never widen beyond what was asked.** Pre-existing comments outside
the diff are out of scope unless the user named that file.

## The test

For each comment, in order:

1. **Is it a genuine hack, an upstream-bug workaround, or a non-obvious external
   constraint?** Keep it — but require a `TODO(<owner>): <ticket-url>` when it marks
   work to undo later. A hack comment with no ticket is an unfinished hack; add the
   TODO or ask the user for the ticket.
2. **Does it explain _why_ something surprising is done?** Keep it if an experienced
   reader would otherwise assume the code is a mistake. One or two sentences, no more.
3. **Could a better name make it unnecessary?** Rename instead. Extract the block into
   a named function, promote the magic value to a named constant, or rename the
   variable — then delete the comment. This is the most common outcome and the whole
   point of the skill.
4. **Otherwise, delete it.**

## Delete on sight

- Restatements of the next line (`// increment the counter`).
- Restatements of a type, zod schema, decorator, or field name.
- Section banners (`// ---- helpers ----`), file-header summaries, `@param`/`@returns`
  JSDoc that adds nothing a signature does not already state.
- Commented-out code — git has it.
- Narration of _what_ over _why_.
- Bare ticket refs with no explanation (`// ABC-123`).
- Comments describing behaviour that the code no longer has. These are the reason
  the rule exists; flag them loudly, since a stale comment is worse than none.

Config counts as code here — `.env.example`, `vercel.json`, CI YAML. Keep only
what the file cannot show: hidden behaviour of the consuming tool, a key that is
inert unless mirrored elsewhere, an upstream-bug workaround. Delete the rest.

**Docs are not comments.** `CLAUDE.md` is this repo's one design document and the
right home for the context you are stripping out of code. When deleting a
comment that carries real architectural reasoning — an invariant, a rule future
work must follow — move it into the matching `CLAUDE.md` section rather than
dropping it. Do not move the story of a change; git log holds that.

## Applying

Edit directly — this skill fixes, it does not just report. A rename must land
everywhere the name is used; run `npm run typecheck` and `npm run lint`
afterwards, since renames break callers and a deleted comment never does.

Never change behaviour. If removing a comment tempts a refactor beyond renaming and
extraction, stop and raise it instead.

## Reporting

Close with a short list: comments deleted (grouped by reason), comments kept and why,
and any rename that rippled beyond the diff. Say plainly if the code was already clean.
