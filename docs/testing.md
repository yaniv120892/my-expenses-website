# Testing

Load before writing or fixing a unit, component, hook or type test, or touching
`vitest.config.ts` or `src/test/`.

- Vitest runs on `node`. A component or hook test opts into a DOM with a
  `// @vitest-environment jsdom` docblock and renders through `src/test/renderWithClient.tsx`,
  which supplies the shared theme and English messages (`DesignTestProvider locale="he"` renders
  Hebrew). Keep DOM-free logic in plain `.ts` modules.
- `@yaniv120892/my-ui` is inlined for Vite (`server.deps.inline`), as is
  `@yaniv120892/observability`, and `src/test/setup.ts` stubs `next/navigation`, whose
  `useRouter` its `I18nProvider` calls.
- `*.test-d.ts` type assertions run inside `npm test`; `npm run test:types` runs only them.
- The e2e suites: `npm run test:e2e:api` is the API/chat harness (`test/e2e-api/README.md`),
  `npm run test:e2e:ui` the Playwright specs in `e2e/`. CI runs both against a Postgres service
  container. The API harness also holds the household leak guard →
  [households.md](households.md), before changing household scoping.
