import { recordPageView } from '@/server/pageViews';

export default async function SubscriptionsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await recordPageView('subscriptions');
  return children;
}
