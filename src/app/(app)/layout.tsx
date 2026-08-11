import AppShell from '@/components/shell/AppShell';
import Chat from '@/components/chat/Chat';
import WhatsNewAutoDialog from '@/components/announcements/WhatsNewAutoDialog';

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <AppShell>
      {children}
      <Chat />
      <WhatsNewAutoDialog />
    </AppShell>
  );
}
