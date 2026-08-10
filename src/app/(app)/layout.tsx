import AppShell from '@/components/shell/AppShell';
import Chat from '@/components/chat/Chat';

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppShell>
      {children}
      <Chat />
    </AppShell>
  );
}
