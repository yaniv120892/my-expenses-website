import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // Node by default; component tests opt into jsdom with a
    // `@vitest-environment jsdom` docblock so the rest stay fast.
    environment: 'node',
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
