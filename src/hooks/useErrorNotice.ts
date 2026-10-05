import { useState } from 'react';

/** Error state for a `NotificationSnackbar`; the message outlives `open` so the exit transition keeps its text. */
export function useErrorNotice() {
  const [message, setMessage] = useState('');
  const [open, setOpen] = useState(false);

  function showError(next: string) {
    setMessage(next);
    setOpen(true);
  }

  return {
    showError,
    snackbarProps: {
      open,
      message,
      severity: 'error',
      onClose: () => setOpen(false),
    } as const,
  };
}
