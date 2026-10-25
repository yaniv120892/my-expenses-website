import * as Sentry from '@sentry/nextjs';

// Every value is read inline: Next's minifier inlines a constant-folded
// parameter into an unbound `{environment}` shorthand that throws in the
// browser bundle.
export function initSentry(): void {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment:
      process.env.NEXT_PUBLIC_VERCEL_ENV ??
      process.env.VERCEL_ENV ??
      process.env.NODE_ENV,
    // Traces and Session Replay bill against their own quotas; only errors are
    // budgeted.
    tracesSampleRate: 0,
    dataCollection: NO_REQUEST_DATA_COLLECTION,
  });
}

const IDENTIFYING_KEY_PATTERNS = [
  'forwarded',
  '-ip',
  'remote-',
  'via',
  '-user',
];

// An unset `dataCollection` sends cookies (the session JWT), identifying
// headers and every request body (passwords, transactions). This is the SDK's
// documented no-PII baseline.
const NO_REQUEST_DATA_COLLECTION = {
  userInfo: false,
  cookies: false,
  httpHeaders: {
    request: { deny: IDENTIFYING_KEY_PATTERNS },
    response: { deny: IDENTIFYING_KEY_PATTERNS },
  },
  httpBodies: [],
  urlQueryParams: { deny: IDENTIFYING_KEY_PATTERNS },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  graphQL: { document: false, variables: false },
} satisfies Sentry.BrowserOptions['dataCollection'];
