import http from 'http';
import { startUpstashShim, seedKey } from './upstashShim';
import { redisKeyPrefix } from '../../src/server/redis';
import { startMockModelServer } from './mockModelServer';
import { startMockExtractionAgent } from './mockExtractionAgent';
import { seed, sessionForExistingUser, SeededUser, SeedResult } from './seed';

/**
 * Brings up the supporting services and seeds data.
 *
 * Shared by both entry points so the session-key format lives in one place:
 * `run.ts` runs the checks and exits, `serve.ts` stays up while Playwright
 * drives the website.
 */
type Services = {
  shim: http.Server;
  mock: http.Server;
  extraction: http.Server | null;
  stop: () => void;
};

export type Stack = Services & { seeded: SeedResult };

/** The same services over a database that keeps its data: no seed, one session. */
export type UserStack = Services & { user: SeededUser };

export type StackPorts = {
  mock: number;
  shim: number;
  extraction: number | null;
};

export async function startStack(ports: StackPorts): Promise<Stack> {
  const services = await startServices(ports);
  const seeded = await seed();

  for (const user of [seeded.userA, seeded.userB]) {
    plantSession(user);
  }

  return { ...services, seeded };
}

export async function startStackForUser(
  ports: StackPorts,
  email: string,
): Promise<UserStack> {
  const services = await startServices(ports);
  const user = await sessionForExistingUser(email);
  plantSession(user);

  return { ...services, user };
}

async function startServices(ports: StackPorts): Promise<Services> {
  const shim = await startUpstashShim(ports.shim);
  const mock = await startMockModelServer(ports.mock);
  const extraction =
    ports.extraction === null
      ? null
      : await startMockExtractionAgent(ports.extraction);

  return {
    shim,
    mock,
    extraction,
    // The listeners keep the event loop alive; without closing them a run
    // finishes its work and then hangs until something kills it.
    stop: () => {
      shim.close();
      mock.close();
      extraction?.close();
    },
  };
}

// authenticateRequest requires both a valid JWT and a live session key.
function plantSession(user: SeededUser): void {
  seedKey(
    `${redisKeyPrefix('branch')}session:${user.id}:${user.token}`,
    JSON.stringify('1'),
  );
}
