import type { Dictionary, Messages } from '@yaniv120892/my-ui';

const en = {
  'pending.title': 'Pending',
  'pending.subtitle': 'Transactions waiting for your approval',
  'pending.loadFailed':
    'Failed to load pending transactions. Please try again.',
  'pending.approved': 'Transaction approved successfully',
  'pending.approveFailed': 'Failed to confirm transaction',
  'pending.rejected': 'Transaction rejected successfully',
  'pending.rejectFailed': 'Failed to delete transaction',
  'pending.empty': 'No pending transactions found.',
  'pending.column.description': 'Description',
  'pending.column.category': 'Category',
  'pending.column.date': 'Date',
  'pending.column.amount': 'Amount',
  'pending.column.actions': 'Actions',
  'pending.approve': 'Approve',
  'pending.delete': 'Delete',
  'pending.approveAria': 'Approve transaction',
  'pending.deleteAria': 'Delete transaction',
  'pending.dialog.question': 'Approve or delete this transaction?',
  'pending.popup.one': 'Hi - you have 1 pending transaction - take a look!',
  'pending.popup.other':
    'Hi - you have {count} pending transactions - take a look!',
} satisfies Messages;

export const pendingMessages: Dictionary<typeof en> = {
  en,
  he: {
    'pending.title': 'ממתינות',
    'pending.subtitle': 'תנועות שמחכות לאישור שלך',
    'pending.loadFailed': 'טעינת התנועות הממתינות נכשלה. נסו שוב.',
    'pending.approved': 'התנועה אושרה',
    'pending.approveFailed': 'אישור התנועה נכשל',
    'pending.rejected': 'התנועה נדחתה',
    'pending.rejectFailed': 'מחיקת התנועה נכשלה',
    'pending.empty': 'אין תנועות ממתינות.',
    'pending.column.description': 'תיאור',
    'pending.column.category': 'קטגוריה',
    'pending.column.date': 'תאריך',
    'pending.column.amount': 'סכום',
    'pending.column.actions': 'פעולות',
    'pending.approve': 'אישור',
    'pending.delete': 'מחיקה',
    'pending.approveAria': 'אישור התנועה',
    'pending.deleteAria': 'מחיקת התנועה',
    'pending.dialog.question': 'לאשר את התנועה או למחוק אותה?',
    'pending.popup.one': 'היי, יש לך תנועה אחת שממתינה לאישור — כדאי להציץ!',
    'pending.popup.other':
      'היי, יש לך {count} תנועות שממתינות לאישור — כדאי להציץ!',
  },
};
