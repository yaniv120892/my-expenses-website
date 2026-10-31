# Claude Code tooling

Load before editing anything under `.claude/` (skills, rules, `settings.json`) or deciding whether
a vendored or a plugin skill wins.

## Plugins

`.claude/settings.json` references the `yaniv120892/claude-config` marketplace and enables
`pr-workflows` and `dev-workflows`, so those skills, commands and hooks are fetched rather than
copied and stay current; `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` keeps that fetch on HTTPS, since a
fresh container has no SSH key.

## Skills

- `pr-review` and `prune-comments` stay vendored under `.claude/skills/` as MCP-driven variants,
  because this repo's sessions have no `gh` CLI; `steward` stays vendored because remote sessions
  read it from the head branch. Each names its upstream in a `Canonical source` line; edit there
  first, then re-vendor. Where a vendored skill shares a name with a plugin skill, follow the
  vendored copy.
- `proof-of-work` and the examples under `pr-description/references/` are this repo's own — how to
  prove a change here, and what a good description of one looks like — and the plugin's
  `writing-pr-description` reads both.
- `.claude/skills/collect-statements/` holds the per-portal recipes for pulling statements out of
  Cal, Isracard and Amex IL with Claude in Chrome. Credentials and one-time passwords are always
  the human's; the skill records only navigation, and marks what has not been observed rather than
  guessing it.

## Rules

`.claude/rules/` holds the craft rules (comments, control flow, naming, errors, typing, env
wiring, secrets), vendored from `yaniv120892/claude-config`; each loads by its `paths:` list. Edit
a vendored rule upstream first, then re-vendor. A rule file whose header does not say "Vendored"
is this repo's own. The docs are what is true of _this_ system; the rules are how code gets
written anywhere. The mechanically checkable ones (braces, casts, `interface`, abbreviations,
array syntax, member accessibility, promise chains) are enforced by the dev-config ESLint preset,
so CI fails on them rather than review.

`.prettierignore` skips `.claude/rules` and the vendored skills, so formatting drift does not make
the diff against upstream unreadable.
