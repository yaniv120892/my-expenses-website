import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, Server } from 'node:http';
import type { AddressInfo } from 'node:net';

// The stream's own filtering is unit-tested in betterStackStream.test.ts; what
// only the real logger can pin is the multistream level, which decides whether
// an info record reaches the stream to be judged at all.
const batches: Record<string, unknown>[][] = [];
let server: Server;

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      batches.push(JSON.parse(body));
      res.writeHead(202).end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as AddressInfo;
  process.env.BETTERSTACK_SOURCE_URL = `http://127.0.0.1:${port}`;
  process.env.BETTERSTACK_SOURCE_TOKEN = 'test-token';
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });
});

// The eager flush is fire-and-forget, so give its POST a turn to land.
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

function shippedMessages(): unknown[] {
  return batches.flat().map((record) => record.msg);
}

describe('logger remote shipping', () => {
  it('ships marked info, warns and errors, and drops plain info', async () => {
    const { default: logger } = await import('@/server/logging/logger');
    const { flushRemoteLogs } =
      await import('@/server/logging/betterStackStream');

    logger.info({ userId: 'u1' }, 'plain info');
    logger.info({ path: '/api/summary/today', ship: true }, 'request');
    logger.warn(
      { envVar: 'BETTERSTACK_HEARTBEAT_X' },
      'Heartbeat not configured',
    );

    expect(batches).toHaveLength(0);

    logger.error({ err: new Error('boom') }, 'Request failed');
    await settle();

    // The error left without waiting for the request's flush.
    expect(batches).toHaveLength(1);
    expect(batches[0].map((record) => record.msg)).toContain('Request failed');

    await flushRemoteLogs();
    await settle();

    expect(shippedMessages()).toEqual(
      expect.arrayContaining(['request', 'Heartbeat not configured']),
    );
    expect(shippedMessages()).not.toContain('plain info');
  });
});
