import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// The CLI only migrates, so it takes the direct endpoint: a transaction pooler
// does not hold the advisory lock `prisma migrate` takes. Read without `env()`,
// which throws when unset, so `prisma generate` runs where no database exists.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DIRECT_URL },
});
