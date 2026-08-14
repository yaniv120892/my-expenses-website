---
name: maintenance-dead-code
description: Daily maintenance routine that finds and removes provably unreachable code — unused exports, orphaned components, dead helpers, unused dependencies — and opens one focused PR. Use when running the scheduled dead-code sweep or when asked to hunt for dead code in this repo.
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
---

# Dead-code sweep

Remove code that nothing can reach. Read `docs/maintenance/pr-protocol.md`
first — the backpressure check, the verification gate, and the one-concern-per-PR
rule all apply.

The bar is **provably unreachable**, not "looks unused". This codebase has
several ways a file can be live with no in-repo caller, listed under Never
delete below. Getting this wrong deletes working behaviour and the routine
loses the reviewer's trust, so when the evidence is ambiguous, leave it.

## Hunting grounds

In rough order of yield:

- `src/server/services/**`, `src/server/repositories/**` — exported functions
  and methods no route, cron, or assistant tool calls
- `src/shared/schemas/**` — zod schemas nothing validates against any more
- `src/shared/types/**`, `src/types/**` — types with no importer
- `src/components/**` — components no page renders; sub-components orphaned
  when a parent was rewritten
- `src/hooks/**` — query hooks whose page was removed or rewritten
- `src/utils/**`, `src/server/utils/**` — helpers superseded by a newer one
- `package.json` dependencies with no import anywhere in `src/`, `e2e/`,
  `test/`, `prisma/`, or config files
- Residue from removed integrations. Sentry was removed (see `git log`), and
  the Express `my-expenses` API was deprecated in favour of this repo —
  leftover adapters, env references, and config from either are prime targets

## Never delete

These are reachable without an in-repo caller:

- Next.js convention files: `page.tsx`, `layout.tsx`, `route.ts`, `error.tsx`,
  `not-found.tsx`, `loading.tsx`, `template.tsx`, plus `middleware.ts`,
  `instrumentation.ts`, `next.config.ts`
- Cron endpoints listed in `vercel.json` — Vercel calls them, nothing in the
  repo does
- Externally-called webhooks: `/api/webhook` (Telegram),
  `/api/excel-extraction-agent/webhook` (HMAC callback)
- `lazy()` client factories in `src/server/**` — reached at runtime through
  env, and deliberately not constructed at module load
- Anything imported only by `e2e/`, `test/`, `prisma/seed`, or `scripts`
- Exports reached by dynamic `import()` or through a string-keyed registry
- `prisma/schema.prisma` fields and models — unused columns need a migration,
  which is out of bounds for this routine

## Method

1. Generate candidates. `npx --yes knip` or `npx --yes ts-prune` can suggest
   leads, but treat their output as **hints only** — both over-report on
   Next.js convention files and re-exported types.
2. Confirm each candidate by hand. Grep for the symbol across `src/`, `e2e/`,
   `test/`, `prisma/`, `docs/`, and the config files, including as a bare
   string (registries and dynamic imports do not look like imports).
3. Check `git log` on the file. Code added last week that nothing calls yet is
   usually half-finished work, not dead code — leave it and say why.
4. Delete the whole unit, not a fragment: the export, its tests, its types, and
   any import that only existed to feed it.
5. Run the gate: `npm run lint && npm run typecheck && npm test`. Removing a
   component or hook can change rendering, so run the e2e suites too.
6. Open one PR per coherent removal. "Remove the Sentry error adapter and its
   config" is one PR. "Remove 14 unrelated unused exports" is not.

## Evidence to include in the PR

For each deleted symbol, the grep that proves nothing references it, and an
explicit note that the Never-delete cases were checked. A reviewer must be able
to re-run the greps and reach the same conclusion without redoing the search.
