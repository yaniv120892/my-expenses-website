import { z } from 'zod';

const coreEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
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

// Preview deployments get a hostname per deployment, so they leave WEBSITE_URL
// unset: a fixed value would point extraction callbacks and verification links
// at production. VERCEL_BRANCH_URL is preferred over VERCEL_URL because it is
// stable across redeploys of the same branch.
export function requireSiteUrl(): string {
  const vercelHost = process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;
  if (!process.env.WEBSITE_URL && vercelHost) {
    return `https://${vercelHost}`;
  }
  return requireEnv('WEBSITE_URL');
}
