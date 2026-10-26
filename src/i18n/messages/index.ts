import { announcementsMessages } from './announcements';
import { authMessages } from './auth';
import { chatMessages } from './chat';
import { commonMessages } from './common';
import { dashboardMessages } from './dashboard';
import { formatMessages } from './format';
import { importsMessages } from './imports';
import { navMessages } from './nav';
import { pendingMessages } from './pending';
import { scheduledMessages } from './scheduled';
import { settingsMessages } from './settings';
import { subscriptionsMessages } from './subscriptions';
import { transactionsMessages } from './transactions';
import { trendsMessages } from './trends';

export const messageAreas = {
  announcements: announcementsMessages,
  auth: authMessages,
  chat: chatMessages,
  common: commonMessages,
  dashboard: dashboardMessages,
  format: formatMessages,
  imports: importsMessages,
  nav: navMessages,
  pending: pendingMessages,
  scheduled: scheduledMessages,
  settings: settingsMessages,
  subscriptions: subscriptionsMessages,
  transactions: transactionsMessages,
  trends: trendsMessages,
};

export const messages = {
  en: {
    ...announcementsMessages.en,
    ...authMessages.en,
    ...chatMessages.en,
    ...commonMessages.en,
    ...dashboardMessages.en,
    ...formatMessages.en,
    ...importsMessages.en,
    ...navMessages.en,
    ...pendingMessages.en,
    ...scheduledMessages.en,
    ...settingsMessages.en,
    ...subscriptionsMessages.en,
    ...transactionsMessages.en,
    ...trendsMessages.en,
  },
  he: {
    ...announcementsMessages.he,
    ...authMessages.he,
    ...chatMessages.he,
    ...commonMessages.he,
    ...dashboardMessages.he,
    ...formatMessages.he,
    ...importsMessages.he,
    ...navMessages.he,
    ...pendingMessages.he,
    ...scheduledMessages.he,
    ...settingsMessages.he,
    ...subscriptionsMessages.he,
    ...transactionsMessages.he,
    ...trendsMessages.he,
  },
};

export type AppMessages = typeof messages.en;
