import type { Dictionary, Messages } from '@yaniv120892/my-ui';

const en = {
  'announcements.whatsNew': "What's new",
  'announcements.gotIt': 'Got it',
  'announcements.close': 'Close',
} satisfies Messages;

export const announcementsMessages: Dictionary<typeof en> = {
  en,
  he: {
    'announcements.whatsNew': 'מה חדש',
    'announcements.gotIt': 'הבנתי',
    'announcements.close': 'סגירה',
  },
};
