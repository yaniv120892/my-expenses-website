---
paths:
  - '**/*.md'
description: How to write rule files, review checklists, and CLAUDE.md-style docs.
---

# Authoring Rules and Docs

Vendored from `yaniv120892/claude-config` (`rules/authoring-docs.md`) so it loads for every
session in this repo — including Claude Code on the web and any contributor who has
not run that repo's `install.sh`. Keep it in sync with upstream; edit there first.

**Rules and Docs State Invariants, Not a Census of Current Violations** — a list of what
currently violates a rule rots silently, and invites "my code matches the neighbour, so it's fine"

> Pattern: State the invariant, then point at the file to verify against. Note that pre-existing
> violations exist without enumerating them.
> Avoid: Bullet lists of which fields/files break the rule today.
