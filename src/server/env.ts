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
