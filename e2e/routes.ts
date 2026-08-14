/**
 * The authenticated pages behind the AppShell drawer.
 *
 * Shared by the smoke spec (which asserts each one renders) and the crash
 * fuzzer (which uses them as crawl entry points), so a new page only has to be
 * registered once.
 */
export const APP_PAGES: { path: string; heading: string | RegExp }[] = [
  { path: '/dashboard', heading: 'Dashboard' },
  { path: '/transactions', heading: 'Transactions' },
  { path: '/pending', heading: /pending/i },
  { path: '/scheduled', heading: /scheduled/i },
  { path: '/subscriptions', heading: 'Subscriptions' },
  { path: '/imports', heading: 'Imports' },
  { path: '/trends', heading: 'Trends' },
  { path: '/settings', heading: 'Settings' },
];
