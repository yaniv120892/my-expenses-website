import { recordPageView } from '@/server/pageViews';

export default async function TransactionsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await recordPageView('transactions');
  return children;
}
