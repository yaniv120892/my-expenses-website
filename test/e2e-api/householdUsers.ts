// Imported by e2e/household.spec.ts as well as the seed, so it imports nothing:
// the Playwright process must not load the Prisma client.
export const SEED_PASSWORD = 'local-dev-password';

/**
 * Users with no data, each in a household of their own, for the household
 * sharing spec: it signs them in through the login form and moves them
 * between households, so no other spec may use them.
 */
export const HOUSEHOLD_E2E_USERS = {
  owner: { username: 'hh-owner', email: 'hh-owner@e2e.test' },
  editor: { username: 'hh-editor', email: 'hh-editor@e2e.test' },
  viewer: { username: 'hh-viewer', email: 'hh-viewer@e2e.test' },
  outsider: { username: 'hh-outsider', email: 'hh-outsider@e2e.test' },
} as const;
