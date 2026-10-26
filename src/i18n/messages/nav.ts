import type { Dictionary, Messages } from '@yaniv120892/my-ui';

const en = {
  'nav.dashboard': 'Dashboard',
  'nav.transactions': 'Transactions',
  'nav.pending': 'Pending',
  'nav.scheduled': 'Scheduled',
  'nav.subscriptions': 'Subscriptions',
  'nav.imports': 'Imports',
  'nav.trends': 'Trends',
  'nav.settings': 'Settings',
} satisfies Messages;

export const navMessages: Dictionary<typeof en> = {
  en,
  he: {
    'nav.dashboard': 'לוח בקרה',
    'nav.transactions': 'תנועות',
    'nav.pending': 'ממתינות',
    'nav.scheduled': 'קבועות',
    'nav.subscriptions': 'מינויים',
    'nav.imports': 'ייבוא',
    'nav.trends': 'מגמות',
    'nav.settings': 'הגדרות',
  },
};
