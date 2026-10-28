import { recordPageView } from '@/server/pageViews';

export default async function ImportsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await recordPageView('imports');
  return children;
}
