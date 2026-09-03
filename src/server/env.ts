import { z } from 'zod';

const POOLED_HOST_MARKER = '-pooler';

const coreEnvSchema = z.object({
  DATABASE_URL: z.string().min(1).refine(pooledUrlDisablesPreparedStatements, {
    message:
      'DATABASE_URL names a pooled endpoint without pgbouncer=true; add it (and connection_limit=1 on serverless)',
  }),
  DIRECT_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  REDIS_URL: z.string().min(1),
  REDIS_TOKEN: z.string().min(1),
  CRON_SECRET: z.string().min(1),
});

// Called from instrumentation.ts so a misconfigured deployment fails at boot
// instead of on the first request.
export function assertCoreEnv(): void {
  coreEnvSchema.parse(process.env);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

// A preview gets a hostname per deployment, so it leaves WEBSITE_URL unset and
// derives the origin from Vercel's own vars. Production names itself instead:
// those vars resolve there too, so falling back would quietly mail real users a
// vercel.app link rather than failing where someone would notice.
export function requireSiteUrl(): string {
  return (
    process.env.WEBSITE_URL || previewSiteUrl() || requireEnv('WEBSITE_URL')
  );
}

// A pooler in transaction mode hands the next query a different backend, where
// the prepared statements Prisma names by default collide. Neon's console
// offers the pooled URL without `pgbouncer=true`, and the resulting
// `prepared statement "s0" already exists` surfaces only under concurrency.
function pooledUrlDisablesPreparedStatements(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return true;
  }
  if (!parsed.hostname.includes(POOLED_HOST_MARKER)) {
    return true;
  }
  return parsed.searchParams.get('pgbouncer') === 'true';
}

// VERCEL_BRANCH_URL before VERCEL_URL because it survives a redeploy of the same
// branch; `||` rather than `??` because Vercel sets both to the empty string for
// a deployment that has no branch.
function previewSiteUrl(): string | undefined {
  if (process.env.VERCEL_ENV === 'production') {
    return undefined;
  }
  const vercelHost = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
  if (!vercelHost) {
    return undefined;
  }
  return `https://${vercelHost}`;
}
