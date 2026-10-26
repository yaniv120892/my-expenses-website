import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'src/**/*.test.{ts,tsx}',
      'scripts/**/*.test.ts',
      'prisma.config.test.ts',
    ],
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    // The shared UI package ships extensionless ESM imports for the bundler.
    server: { deps: { inline: ['@yaniv120892/my-ui'] } },
    typecheck: {
      enabled: true,
      include: ['src/**/*.test-d.ts'],
    },
  },
  // tsconfig sets jsx: "preserve" for Next, so the transform needs telling how
  // to compile the JSX in component tests.
  oxc: {
    jsx: { runtime: 'automatic' },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
