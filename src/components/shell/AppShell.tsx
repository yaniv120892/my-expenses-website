'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AppBar,
  Badge,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
  useColorScheme,
} from '@mui/material';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import EventRepeatOutlinedIcon from '@mui/icons-material/EventRepeatOutlined';
import AutorenewOutlinedIcon from '@mui/icons-material/AutorenewOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import WhatsNewLauncher from '@/components/announcements/WhatsNewLauncher';
import { usePendingTransactionsQuery } from '@/hooks/usePendingTransactionsQuery';
import { useSession } from '@/hooks/useSession';
import { logout } from '@/services/authClient';

export const DRAWER_WIDTH = 248;

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: SpaceDashboardOutlinedIcon },
  {
    label: 'Transactions',
    href: '/transactions',
    icon: ReceiptLongOutlinedIcon,
  },
  { label: 'Pending', href: '/pending', icon: PendingActionsOutlinedIcon },
  { label: 'Scheduled', href: '/scheduled', icon: EventRepeatOutlinedIcon },
  {
    label: 'Subscriptions',
    href: '/subscriptions',
    icon: AutorenewOutlinedIcon,
  },
  { label: 'Imports', href: '/imports', icon: UploadFileOutlinedIcon },
  { label: 'Trends', href: '/trends', icon: TrendingUpOutlinedIcon },
  { label: 'Settings', href: '/settings', icon: SettingsOutlinedIcon },
] as const;

function ModeToggle() {
  const { mode, setMode } = useColorScheme();
  const isDark = mode === 'dark';
  return (
    <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
      <IconButton
        size="small"
        onClick={() => setMode(isDark ? 'light' : 'dark')}
        aria-label="Toggle color mode"
      >
        {isDark ? (
          <LightModeOutlinedIcon fontSize="small" />
        ) : (
          <DarkModeOutlinedIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: pending } = usePendingTransactionsQuery();
  const pendingCount = pending?.length ?? 0;

  return (
    <List sx={{ px: 1.5, py: 0.5, flex: 1 }}>
      {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const selected = pathname.startsWith(href);
        return (
          <ListItem key={href} disablePadding sx={{ mb: 0.25 }}>
            <ListItemButton
              component={Link}
              href={href}
              onClick={onNavigate}
              selected={selected}
              sx={{
                borderRadius: 2,
                py: 1,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': { bgcolor: 'primary.main' },
                  '& .MuiListItemIcon-root': {
                    color: 'primary.contrastText',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 38 }}>
                {href === '/pending' ? (
                  <Badge badgeContent={pendingCount} color="error" max={99}>
                    <Icon fontSize="small" />
                  </Badge>
                ) : (
                  <Icon fontSize="small" />
                )}
              </ListItemIcon>
              <ListItemText
                primary={label}
                primaryTypographyProps={{
                  fontSize: '0.9rem',
                  fontWeight: selected ? 600 : 500,
                }}
              />
            </ListItemButton>
          </ListItem>
        );
      })}
    </List>
  );
}

function DrawerContent({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const { data: session } = useSession();

  async function handleLogout() {
    await logout();
    router.push('/login');
  }

  return (
    <Stack sx={{ height: '100%' }}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ px: 2.5, py: 2.5 }}
      >
        <AccountBalanceWalletRoundedIcon color="primary" />
        <Typography variant="h5" component="span">
          My Expenses
        </Typography>
      </Stack>
      <NavList onNavigate={onNavigate} />
      <Divider />
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 2, py: 1.5 }}
      >
        <Typography
          variant="body2"
          color="text.secondary"
          noWrap
          sx={{ maxWidth: 140 }}
          title={session?.email ?? undefined}
        >
          {session?.email ?? ''}
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <WhatsNewLauncher />
          <ModeToggle />
          <Tooltip title="Log out">
            <IconButton
              size="small"
              onClick={handleLogout}
              aria-label="Log out"
            >
              <LogoutRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Stack>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const currentPage = NAV_ITEMS.find((item) =>
    pathname.startsWith(item.href),
  )?.label;

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: 1,
            borderColor: 'divider',
          },
        }}
      >
        <DrawerContent />
      </Drawer>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
        }}
      >
        <DrawerContent onNavigate={() => setMobileOpen(false)} />
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <AppBar
          position="sticky"
          sx={{
            display: { md: 'none' },
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Toolbar sx={{ minHeight: 56 }}>
            <IconButton
              edge="start"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              sx={{ mr: 1.5 }}
            >
              <MenuRoundedIcon />
            </IconButton>
            <Typography variant="h5" component="h1" color="text.primary">
              {currentPage ?? 'My Expenses'}
            </Typography>
          </Toolbar>
        </AppBar>

        <Box
          sx={{
            flex: 1,
            width: '100%',
            maxWidth: 1200,
            mx: 'auto',
            px: { xs: 2, sm: 3 },
            py: { xs: 2, md: 3 },
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
