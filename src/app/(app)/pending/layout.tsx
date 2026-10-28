import { recordPageView } from '@/server/pageViews';

export default async function PendingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await recordPageView('pending');
  return children;
}
