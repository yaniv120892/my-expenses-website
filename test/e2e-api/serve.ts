import { MOCK_PORT, SHIM_PORT, EXTRACTION_MOCK_PORT } from './ports';
import { SEED_PASSWORD, SeededUser } from './seed';
import { startStack, startStackForUser } from './stack';

// Unlike run.ts, stays up so Playwright can drive the site against it.
async function main(): Promise<void> {
  const ports = {
    mock: MOCK_PORT,
    shim: SHIM_PORT,
    extraction: EXTRACTION_MOCK_PORT,
  };
  const sessionUserEmail = process.env.SESSION_USER_EMAIL;

  const { user, password } = sessionUserEmail
    ? await forExistingUser(sessionUserEmail)
    : await seeded();

  // An interface, not debug output: the Playwright run reads the token and
  // scripts/dev-local.sh reads the credentials.
  console.log(`E2E_AUTH_TOKEN=${user.token}`);
  console.log(`E2E_USER_ID=${user.id}`);
  console.log(`E2E_USER_EMAIL=${user.email}`);
  console.log(`E2E_PASSWORD=${password}`);
  console.log('ready');

  async function seeded(): Promise<{ user: SeededUser; password: string }> {
    const stack = await startStack(ports);
    return { user: stack.seeded.userA, password: SEED_PASSWORD };
  }

  async function forExistingUser(
    email: string,
  ): Promise<{ user: SeededUser; password: string }> {
    const stack = await startStackForUser(ports, email);
    return { user: stack.user, password: '' };
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
