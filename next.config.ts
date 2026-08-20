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

// The plugin reads org/project/authToken from these vars itself; this only
// decides whether to generate source maps at all, so a local or CI build
// without the token skips the work instead of emitting maps it cannot upload.
const canUploadSourceMaps = Boolean(
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT,
);

export default withSentryConfig(nextConfig, {
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
