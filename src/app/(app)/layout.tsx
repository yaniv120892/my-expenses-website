import ExpensesShell from '@/components/shell/ExpensesShell';
import Chat from '@/components/chat/Chat';
import WhatsNewAutoDialog from '@/components/announcements/WhatsNewAutoDialog';

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ExpensesShell>
      {children}
      <Chat />
      <WhatsNewAutoDialog />
    </ExpensesShell>
  );
}
