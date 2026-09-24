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
  // A typo here, or the flag without a key, would silently keep the LLM
  // categorizing while the operator believes Jev is live, so boot fails instead.
  AI_CATEGORY_SUGGESTER: z.preprocess(
    lowercaseString,
    z.enum(['', 'jev', 'jev-two-step']).optional(),
  ),
  TYPESAFE_AI_API_KEY: z.string().optional(),
  AI_GATEWAY_API_KEY: z.string().optional(),
});

const envSchema = coreEnvSchema.refine(
  (env) =>
    !env.AI_CATEGORY_SUGGESTER ||
    Boolean(env.TYPESAFE_AI_API_KEY || env.AI_GATEWAY_API_KEY),
  {
    message:
      'AI_CATEGORY_SUGGESTER needs TYPESAFE_AI_API_KEY or AI_GATEWAY_API_KEY',
    path: ['AI_CATEGORY_SUGGESTER'],
  },
);

export function assertCoreEnv(): void {
  envSchema.parse(process.env);
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

// `||` rather than `??`: a copied `.env.example` leaves a var set to the empty
// string, and an empty model id or URL is never what a caller meant.
export function optionalEnv(name: string, fallback = ''): string {
  return process.env[name] || fallback;
}

export function requireSiteUrl(): string {
  return (
    process.env.WEBSITE_URL || previewSiteUrl() || requireEnv('WEBSITE_URL')
  );
}

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
  // The Vercel vars resolve in production too; falling back there would mail
  // real users a vercel.app link instead of failing on a lost WEBSITE_URL.
  if (process.env.VERCEL_ENV === 'production') {
    return undefined;
  }
  const vercelHost = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
  if (!vercelHost) {
    return undefined;
  }
  return `https://${vercelHost}`;
}

function lowercaseString(value: unknown): unknown {
  return typeof value === 'string' ? value.toLowerCase() : value;
}
