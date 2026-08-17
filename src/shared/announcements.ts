import { Announcement } from '@/shared/types/announcement';

/**
 * Every in-app announcement, newest first.
 *
 * To announce a release, add an entry at the top in the same commit as the
 * feature. Ids are permanent — users who have acknowledged one are keyed by it,
 * so editing an id re-shows the announcement to everybody.
 */
export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: '2026-08-transactions-csv-export',
    publishedAt: '2026-08-17',
    title: 'Take your transactions with you',
    hook: 'Anything you can see on the transactions page can now leave it as a spreadsheet.',
    items: [
      {
        icon: 'download',
        tag: 'New',
        headline: 'Export any view to CSV',
        body: 'Filter by month, category, type or search text, then hit Export CSV. You get every transaction that matches — not just the rows already scrolled into view — ready for Excel or Sheets.',
        cta: { label: 'Try it', href: '/transactions' },
      },
    ],
  },
  {
    id: '2026-08-compare-and-monthly-report',
    publishedAt: '2026-08-11',
    title: 'Three new ways to see where your money goes',
    hook: 'You asked to compare categories and to get a monthly recap. Both are live.',
    items: [
      {
        icon: 'compare',
        tag: 'New',
        headline: 'Put any two categories side by side',
        body: 'Pick up to 8 categories and see them month by month in one chart and one table — business income next to equipment spend, on the same axis.',
        cta: { label: 'Open Compare', href: '/trends' },
      },
      {
        icon: 'email',
        tag: 'New',
        headline: "Last month's numbers, in your inbox",
        body: 'Switch on the monthly report and on the 1st of every month we email you the totals, a category breakdown, and a CSV of every transaction.',
        cta: { label: 'Turn it on', href: '/settings' },
      },
      {
        icon: 'category',
        tag: 'New',
        headline: 'Track what you pay your people',
        body: 'A new Business - Employees category keeps salaries and contractor payments separate from the rest of your business spend.',
        cta: { label: 'Add a transaction', href: '/transactions' },
      },
    ],
  },
];

export const ANNOUNCEMENT_IDS = ANNOUNCEMENTS.map(
  (announcement) => announcement.id,
);
