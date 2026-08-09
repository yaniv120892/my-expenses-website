import http from 'http';
import { startUpstashShim, seedKey } from './upstashShim';
import { startMockModelServer } from './mockModelServer';
import { seed, SeedResult } from './seed';

/**
 * Brings up the supporting services and seeds data.
 *
 * Shared by both entry points so the session-key format lives in one place:
 * `run.ts` runs the checks and exits, `serve.ts` stays up while Playwright
 * drives the website.
 */
export interface Stack {
  shim: http.Server;
  mock: http.Server;
  seeded: SeedResult;
  stop: () => void;
}

export async function startStack(ports: {
  mock: number;
  shim: number;
}): Promise<Stack> {
  const shim = await startUpstashShim(ports.shim);
  const mock = await startMockModelServer(ports.mock);

  const seeded = await seed();

  // authenticateRequest requires both a valid JWT and a live session key.
  for (const user of [seeded.userA, seeded.userB]) {
    seedKey(`session:${user.id}:${user.token}`, JSON.stringify('1'));
  }

  return {
    shim,
    mock,
    seeded,
    // Both listeners keep the event loop alive; without closing them a run
    // finishes its work and then hangs until something kills it.
    stop: () => {
      shim.close();
      mock.close();
    },
  };
}
