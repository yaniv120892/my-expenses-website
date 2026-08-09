import { z } from 'zod';

const coreEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  REDIS_URL: z.string().min(1),
  REDIS_TOKEN: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  LOG_LEVEL: z.string().default('info'),
  NODE_ENV: z.string().default('development'),
});

export type CoreEnv = z.infer<typeof coreEnvSchema>;

let cachedCoreEnv: CoreEnv | undefined;

export function coreEnv(): CoreEnv {
  if (!cachedCoreEnv) {
    cachedCoreEnv = coreEnvSchema.parse(process.env);
  }
  return cachedCoreEnv;
}

// Called from instrumentation.ts so a misconfigured deployment fails at boot
// instead of on the first request.
export function assertCoreEnv(): void {
  coreEnv();
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
