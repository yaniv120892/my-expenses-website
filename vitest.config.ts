import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Node by default; component tests opt into jsdom with a
    // `@vitest-environment jsdom` docblock so the rest stay fast.
    environment: 'node',
    // Type assertions are checked by tsc, and `enabled` puts them in the
    // default `npm test` run rather than behind a separate opt-in.
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
