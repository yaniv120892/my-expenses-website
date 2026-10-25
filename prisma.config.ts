import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

// Explicit options beat dotenv 18's unprefixed DOTENV_PATH and DOTENV_OVERRIDE,
// generic names another tool may export: either could load a file over a
// preset DIRECT_URL and send `migrate` to a different database.
config({ path: '.env', override: false, quiet: true });

// The CLI only migrates, so it takes the direct endpoint: a transaction pooler
// does not hold the advisory lock `prisma migrate` takes. Read without `env()`,
// which throws when unset, so `prisma generate` runs where no database exists.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DIRECT_URL },
});
