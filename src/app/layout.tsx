import type { Metadata, Viewport } from 'next';
import { Heebo } from 'next/font/google';
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { commonMessages as sharedMessages, DesignProvider } from '@yaniv120892/my-ui';
import { getLocale, localeDirection } from '@yaniv120892/my-ui/server';
import Providers from '@/components/Providers';
import { APP_URLS } from '@/config/appUrls';
import { messages } from '@/i18n/messages';
import './globals.css';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  display: 'swap',
  variable: '--font-sans',
});

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: sharedMessages[locale]['app.expenses'],
    description: messages[locale]['meta.description'],
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      dir={localeDirection(locale)}
      className={heebo.variable}
      suppressHydrationWarning
    >
      <body>
        <InitColorSchemeScript attribute="data" />
        <DesignProvider locale={locale} messages={messages[locale]} appUrls={APP_URLS}>
          <Providers>{children}</Providers>
        </DesignProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
