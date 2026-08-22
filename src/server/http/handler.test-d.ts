import { expectTypeOf, test } from 'vitest';
import { z } from 'zod';
import { createHandler } from '@/server/http/handler';

type Options = Parameters<typeof createHandler>[0];
type Handler = () => Promise<{ ok: true }>;

test('a cron route may declare a heartbeat env var', () => {
  expectTypeOf<{
    auth: 'cron';
    heartbeatEnvVar: string;
    handler: Handler;
  }>().toExtend<Options>();
});

test('a non-cron route may not declare a heartbeat env var', () => {
  expectTypeOf<{ auth: 'session'; handler: Handler }>().toExtend<Options>();

  expectTypeOf<{
    auth: 'session';
    heartbeatEnvVar: string;
    handler: Handler;
  }>().not.toExtend<Options>();

  expectTypeOf<{
    auth: 'public';
    heartbeatEnvVar: string;
    handler: Handler;
  }>().not.toExtend<Options>();

  expectTypeOf<{
    auth: 'telegram';
    heartbeatEnvVar: string;
    handler: Handler;
  }>().not.toExtend<Options>();
});

test('body and query inference survives the union', () => {
  createHandler({
    auth: 'session',
    bodySchema: z.object({ amount: z.number() }),
    querySchema: z.object({ page: z.coerce.number() }),
    handler: async ({ body, query }) => {
      expectTypeOf(body).toEqualTypeOf<{ amount: number }>();
      expectTypeOf(query).toEqualTypeOf<{ page: number }>();
      return { ok: true };
    },
  });
});
