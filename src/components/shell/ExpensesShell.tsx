'use client';

import { AppShell, type NavItem } from '@yaniv120892/my-ui';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import AutorenewOutlinedIcon from '@mui/icons-material/AutorenewOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import WhatsNewLauncher from '@/components/announcements/WhatsNewLauncher';
import { usePendingTransactionsQuery } from '@/hooks/usePendingTransactionsQuery';
import { useSession } from '@/hooks/useSession';
import { useT } from '@/i18n/useT';
import { logout } from '@/services/authClient';
import { hardNavigate } from '@/utils/hardNavigate';

export default function ExpensesShell({ children }: { children: React.ReactNode }) {
  const t = useT();
  const { data: session } = useSession();
  const { data: pending } = usePendingTransactionsQuery();

  const nav: NavItem[] = [
    {
      href: '/dashboard',
      label: t('nav.dashboard'),
      icon: SpaceDashboardOutlinedIcon,
      showInBottomBar: true,
    },
    {
      href: '/transactions',
      label: t('nav.transactions'),
      icon: ReceiptLongOutlinedIcon,
      showInBottomBar: true,
    },
    {
      href: '/pending',
      label: t('nav.pending'),
      icon: PendingActionsOutlinedIcon,
      badge: pending?.length ?? 0,
      showInBottomBar: true,
    },
    {
      href: '/scheduled',
      label: t('nav.scheduled'),
      icon: EventRepeatOutlinedIcon,
    },
    {
      href: '/subscriptions',
      label: t('nav.subscriptions'),
      icon: AutorenewOutlinedIcon,
    },
    { href: '/imports', label: t('nav.imports'), icon: UploadFileOutlinedIcon },
    {
      href: '/trends',
      label: t('nav.trends'),
      icon: TrendingUpOutlinedIcon,
      showInBottomBar: true,
    },
    {
      href: '/settings',
      label: t('nav.settings'),
      icon: SettingsOutlinedIcon,
    },
  ];

  // A full navigation, so the next user never sees this one's cached queries.
  async function handleLogout() {
    await logout();
    hardNavigate('/login');
  }

  return (
    <AppShell
      app="expenses"
      nav={nav}
      accountLabel={session?.email}
      onLogout={handleLogout}
      drawerActions={<WhatsNewLauncher />}
    >
      {children}
    </AppShell>
  );
}
