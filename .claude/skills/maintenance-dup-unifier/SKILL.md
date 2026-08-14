---
name: maintenance-dup-unifier
description: Daily maintenance routine that finds similar-but-slightly-divergent abstractions in this repo and unifies exactly one of them per PR, or reports the divergence as a bug when the copies disagree. Use when running the scheduled duplicate sweep or when asked to find duplicated logic.
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

# Duplicate unifier

Find places where the same idea is implemented more than once and the copies
have drifted apart. Read `docs/maintenance/pr-protocol.md` first — backpressure,
verification gate, and one-concern-per-PR all apply.

The valuable find is not duplication itself. It is **divergence**: two copies
that were once the same and now disagree. That disagreement is either a latent
bug or an undocumented intentional difference, and both are worth a reviewer's
attention. Identical copy-paste is worth much less — unify it only when the
copies are genuinely the same idea, not merely the same shape.

## Hunting grounds

- `src/server/repositories/**` — near-identical Prisma query shapes where one
  copy forgot a `userId` filter, a `deletedAt` check, or an ordering
- `src/server/services/**` — parallel singleton services that each re-derive
  the same date window, pagination, or rounding
- `src/hooks/**` — TanStack query-key factories that drifted, so two hooks key
  the same data differently and one never invalidates
- `src/shared/schemas/**` — zod schemas restating the same shape with different
  optionality, coercion, or error messages
- `src/components/**` — MUI patterns re-implemented per page: empty states,
  loading skeletons, amount colouring, currency and date formatting
- Formatting helpers generally — currency and `date-fns` calls inlined in
  components instead of going through a shared helper
- Route handlers that hand-roll error mapping instead of going through
  `createHandler` (`src/server/http/handler.ts`)
- Chart colour access — anything reading a colour that is not
  `theme.palette.charts`

## Rules

**Unify only when the behaviours are provably identical.** Read both copies
fully. If they differ, do not paper over it: decide which behaviour is correct,
say why in the PR, and treat the change as a bug fix with that framing.

**Never unify with a mode flag.** Adding a boolean or `variant` parameter so
one function can serve both callers trades duplication for coupling, and the
result is harder to change than the copies were. If unification needs more than
one flag, or any flag that changes control flow rather than a value, leave the
duplication alone and say so.

**Two copies is usually not enough.** Two similar blocks are often coincidence.
Three or more, or two that have measurably drifted, is a real pattern. Prefer
the drifted pair over the tidy triple.

**Respect the layering.** Shared code lands where its callers live:
`src/utils/**` for client, `src/server/utils/**` for server, `src/components/**`
for presentational pieces, `src/shared/**` only for things genuinely used by
both sides. Never introduce an import from `src/server/**` into a client
component.

**Behaviour must not change.** Rendered output and API responses stay identical
unless the PR is explicitly the bug-fix case above, in which case the changed
behaviour is the headline of the PR body, not a footnote.

Style constraints from `CLAUDE.md` hold: MUI `sx` and theme tokens only, no
inline `style=`, no hardcoded hex, no global utility classes.

## Method

1. Search for a candidate pattern across a hunting ground. Structural
   similarity matters more than textual — the same five Prisma arguments in a
   different order is still the same query.
2. Read every copy in full. Diff them mentally and write down each difference.
3. Classify: identical (unify), drifted-and-one-is-wrong (fix, with the bug as
   the headline), or intentionally different (leave, and consider a one-line
   comment explaining why so the next run does not re-flag it).
4. Make the change for **one** abstraction. Update every call site.
5. Run the gate: `npm run lint && npm run typecheck && npm test`, plus both e2e
   suites, since unification touches rendering and responses by nature.

## Evidence to include in the PR

The file:line of every copy, the concrete list of differences found, and which
behaviour was chosen when they disagreed. If the copies were identical, say
that explicitly — it tells the reviewer no behavioural decision was made.
