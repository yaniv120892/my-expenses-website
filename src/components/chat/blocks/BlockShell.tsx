'use client';

import { ReactNode } from 'react';
import { Paper, Typography } from '@mui/material';

/**
 * Common frame for every assistant view, so a chat reply containing a chart, a
 * list and a set of stats reads as one thing rather than three.
 *
 * dir="ltr" is deliberate and not inherited: the bubble around it may be RTL
 * for a Hebrew answer, but these blocks are charts, amounts and dates whose
 * layout is direction-independent — letting them flip would move the amount
 * column away from where every other list in the app puts it.
 */
export default function BlockShell({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <Paper
      variant="outlined"
      dir="ltr"
      sx={{ p: 1.5, mt: 1, bgcolor: 'background.default', width: '100%' }}
    >
      {title && (
        <Typography
          variant="subtitle2"
          sx={{ mb: 1, fontWeight: 700 }}
          dir="auto"
        >
          {title}
        </Typography>
      )}
      {children}
    </Paper>
  );
}
