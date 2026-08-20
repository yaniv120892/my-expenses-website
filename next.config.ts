import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: [
    '@prisma/client',
    'prisma-field-encryption',
    '@mastra/core',
    '@mastra/memory',
    '@mastra/pg',
    'pg',
    'node-telegram-bot-api',
    'nodemailer',
    'pino',
  ],
};

// Uploading source maps needs an org-scoped token that only Vercel holds, so a
// local or CI build without it produces minified stack traces instead of failing.
const canUploadSourceMaps = Boolean(
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT,
);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !canUploadSourceMaps },
  release: { create: canUploadSourceMaps },
  widenClientFileUpload: true,
  // Tracing is off everywhere, so its SDK code is dead weight in the bundle;
  // re-enabling `tracesSampleRate` means dropping this flag too.
  bundleSizeOptimizations: {
    excludeTracing: true,
    excludeDebugStatements: true,
  },
  suppressOnRouterTransitionStartWarning: true,
  telemetry: false,
  silent: !process.env.CI,
});
