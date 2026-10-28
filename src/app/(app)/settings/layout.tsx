import { recordPageView } from '@/server/pageViews';

export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await recordPageView('settings');
  return children;
}
