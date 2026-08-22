import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Node by default; component tests opt into jsdom with a
    // `@vitest-environment jsdom` docblock so the rest stay fast.
    environment: 'node',
    // `*.test-d.ts` files hold type-level assertions checked by tsc; they run
    // as part of `npm test` alongside the runtime suite.
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
