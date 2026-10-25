'use client';

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import type { ApiTokenSummary } from '@/types/apiToken';

type RevokeTokenLabels = {
  title: (tokenName: string) => string;
  consequence: string;
  cancel: string;
  confirm: string;
};

export default function RevokeTokenDialog({
  token,
  labels,
  onCancel,
  onConfirm,
  dir,
}: {
  token: ApiTokenSummary | null;
  labels: RevokeTokenLabels;
  onCancel: () => void;
  onConfirm: (token: ApiTokenSummary) => void;
  dir?: 'rtl' | 'ltr';
}) {
  function confirmRevoke() {
    if (token) {
      onConfirm(token);
    }
  }

  return (
    <Dialog open={!!token} onClose={onCancel} dir={dir}>
      <DialogTitle>{labels.title(token?.name ?? '')}</DialogTitle>
      <DialogContent>
        <DialogContentText>{labels.consequence}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{labels.cancel}</Button>
        <Button color="error" onClick={confirmRevoke}>
          {labels.confirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
