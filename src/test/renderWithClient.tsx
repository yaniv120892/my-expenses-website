import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, RenderResult } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import {
  I18nProvider,
  createAppTheme,
  localeDirection,
  type Locale,
} from '@yaniv120892/my-ui';
import { messages } from '@/i18n/messages';

/** Retries off so a rejected mutation surfaces immediately in tests. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

/** The app theme and English messages, as the root layout provides them. */
export function DesignTestProvider({
  children,
  locale = 'en',
}: {
  children: React.ReactNode;
  locale?: Locale;
}) {
  return (
    <ThemeProvider
      theme={createAppTheme(localeDirection(locale))}
      defaultMode="light"
    >
      <I18nProvider locale={locale} messages={messages[locale]}>
        {children}
      </I18nProvider>
    </ThemeProvider>
  );
}

export function createWrapper(queryClient = createTestQueryClient()) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <DesignTestProvider>{children}</DesignTestProvider>
      </QueryClientProvider>
    );
  };
}

export function renderWithClient(
  ui: React.ReactElement,
  queryClient = createTestQueryClient(),
): RenderResult {
  return render(ui, { wrapper: createWrapper(queryClient) });
}
