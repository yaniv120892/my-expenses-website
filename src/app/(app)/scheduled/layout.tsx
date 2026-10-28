import { recordPageView } from '@/server/pageViews';

export default async function ScheduledLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await recordPageView('scheduled');
  return children;
}
