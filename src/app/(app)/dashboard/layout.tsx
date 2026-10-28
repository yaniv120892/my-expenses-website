import { recordPageView } from '@/server/pageViews';

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await recordPageView('dashboard');
  return children;
}
