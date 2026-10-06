import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

// CSP is frame-ancestors only: MUI/emotion inject runtime <style> tags, so
// script/style directives need nonces and a Report-Only rollout of their own.
// HSTS is set by Vercel at the edge.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // The e2e suites and dev:local address the dev server as 127.0.0.1, which
  // Next 16 otherwise refuses dev assets and the HMR socket to, so nothing hydrates.
  allowedDevOrigins: ['127.0.0.1'],
  // next dev otherwise appends its own agent-rules block to CLAUDE.md, which is
  // this repo's curated design document.
  agentRules: false,
  turbopack: { root: __dirname },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  serverExternalPackages: [
    '@prisma/client',
    '@prisma/adapter-pg',
    '@mastra/core',
    '@mastra/memory',
    '@mastra/pg',
    'pg',
    'node-telegram-bot-api',
    'nodemailer',
    'pino',
  ],
};

// A build without the token skips source maps it could not upload anyway.
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
