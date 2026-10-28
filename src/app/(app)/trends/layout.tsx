import { recordPageView } from '@/server/pageViews';

export default async function TrendsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await recordPageView('trends');
  return children;
}
