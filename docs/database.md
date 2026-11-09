# Database (Prisma)

Load before changing `prisma/schema.prisma`, writing a migration, changing database connection
code or env vars, or adding an encrypted column.

`prisma/schema.prisma` is the model list; migrations are in `prisma/migrations/`. Mastra keeps its
own tables in the `mastra` Postgres schema (not Prisma-managed). Which models are household-owned
→ [households.md](households.md), before adding a model.

## Client and connections

- The schema names no URL — `prisma.config.ts` hands the CLI `DIRECT_URL`, loading `.env` itself.
- `prisma generate` writes the client to `src/generated/prisma` (gitignored; server code imports
  `@/generated/prisma/client`, code a browser can reach only `@/generated/prisma/enums`).
- The app client is that client with three extensions, `src/server/db/cardDigitsEncryption.ts`,
  the attribution stamp (`src/server/db/attribution.ts`) and the household scope guard
  (`systemPrisma` has the first two), connected through
  `@prisma/adapter-pg` with a pool of one and no `statementNameGenerator`, so every statement is
  unnamed and safe in a pooler's reused sessions.
- Every URL handed to `pg` goes through `withVerifyFullSslMode` (`src/server/db/sslMode.ts`), which
  pins `sslmode=require` (and `prefer`, `verify-ca`) to `verify-full`, as pg 8 already treats
  them, unless `uselibpqcompat=true`; the env vars stay as the Prisma CLI reads them.
- On Vercel `DATABASE_URL` is Neon's pooled endpoint; `DIRECT_URL` is the direct endpoint, used by
  migrations, the seed, and Mastra's memory store. Both are scoped per environment, since
  `vercel-build` runs `prisma migrate deploy` against `DIRECT_URL`.
- Local quirks of `prisma dev` → [local-development.md](local-development.md), when a local run
  fails on a prepared statement or `bind message supplies N parameters`.

## Encryption at rest

`Import.creditCardLastFourDigits` is the one encrypted column. `cardDigitsEncryption` encrypts it
with `PRISMA_FIELD_ENCRYPTION_KEY` (cloak's `v1.aesgcm256` format) on every Import write that
takes data, refusing anything but a plain string, and decrypts it as a computed result field, so
every Import a query returns carries the digits. Each write gets a random IV, so the column cannot
be filtered on — `importRepository.findExisting` matches it in memory. A new encrypted column goes
through the same extension.
