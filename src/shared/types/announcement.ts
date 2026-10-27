// Icons are a string union rather than components: this module is imported by
// server code, which must not pull in @mui/icons-material.
export type AnnouncementIcon =
  'compare' | 'email' | 'category' | 'attachment' | 'download' | 'sparkle';

export type AnnouncementTag = 'New' | 'Improved';

export type AnnouncementItem = {
  icon: AnnouncementIcon;
  tag?: AnnouncementTag;
  headline: string;
  body: string;
  cta?: { label: string; href: string };
};

export type Announcement = {
  // Stable and never reused: acknowledgements are keyed by it.
  id: string;
  publishedAt: string;
  title: string;
  hook: string;
  items: AnnouncementItem[];
};

export type AnnouncementWithSeen = {
  seen: boolean;
} & Announcement;
