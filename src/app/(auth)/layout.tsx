'use client';

import { Box, Paper, Stack, Typography } from '@mui/material';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';

export default function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        bgcolor: 'background.default',
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <AccountBalanceWalletRoundedIcon color="primary" fontSize="large" />
        <Typography variant="h2" component="h1">
          My Expenses
        </Typography>
      </Stack>
      <Paper
        sx={{
          p: { xs: 3, sm: 4 },
          width: '100%',
          maxWidth: 420,
          border: 1,
          borderColor: 'divider',
        }}
      >
        {children}
      </Paper>
    </Box>
  );
}
