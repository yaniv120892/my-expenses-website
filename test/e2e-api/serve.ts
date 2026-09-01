import { MOCK_PORT, SHIM_PORT, EXTRACTION_PORT } from './ports';
import { SEED_PASSWORD } from './seed';
import { startStack } from './stack';

/**
 * Starts the supporting services and seeds data, then stays up.
 *
 * `run.ts` brings up the same stack and exits when its checks finish; the
 * browser test needs it alive while Playwright drives the website, so this
 * keeps it running and prints the auth token for the test to use.
 */
async function main(): Promise<void> {
  const { seeded } = await startStack({
    mock: MOCK_PORT,
    shim: SHIM_PORT,
    extraction: EXTRACTION_PORT,
  });

  // An interface, not debug output: the Playwright run reads the token and
  // scripts/dev-local.sh reads the credentials.
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
