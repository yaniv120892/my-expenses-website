import { SEED_PASSWORD } from './seed';
import { startStack } from './stack';

/**
 * Starts the supporting services and seeds data, then stays up.
 *
 * `run.ts` brings up the same stack and exits when its checks finish; the
 * browser test needs it alive while Playwright drives the website, so this
 * keeps it running and prints the auth token for the test to use.
 */
const MOCK_PORT = Number(process.env.E2E_MOCK_PORT || 51231);
const SHIM_PORT = Number(
  new URL(process.env.REDIS_URL || 'http://127.0.0.1:51230').port,
);
const EXTRACTION_PORT = Number(
  new URL(process.env.EXCEL_EXTRACTION_AGENT_URL || 'http://127.0.0.1:51232')
    .port,
);

async function main(): Promise<void> {
  const { seeded } = await startStack({
    mock: MOCK_PORT,
    shim: SHIM_PORT,
    extraction: EXTRACTION_PORT,
  });

  // Consumed by the Playwright run; the credentials by scripts/dev-local.sh,
  // which prints them for signing in through the browser.
  console.log(`E2E_AUTH_TOKEN=${seeded.userA.token}`);
  console.log(`E2E_USER_ID=${seeded.userA.id}`);
  console.log(`E2E_USER_EMAIL=${seeded.userA.email}`);
  console.log(`E2E_PASSWORD=${SEED_PASSWORD}`);
  console.log('ready');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
