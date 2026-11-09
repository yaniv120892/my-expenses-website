import type {
  HouseholdActivityAction,
  HouseholdEntityType,
  HouseholdRole,
} from '@/generated/prisma/enums';

export type HouseholdActivityView = {
  id: string;
  action: HouseholdActivityAction;
  entityType: HouseholdEntityType;
  entityId: string;
  summary: string | null;
  role: HouseholdRole | null;
  /** Null for a system job, or a member whose account is gone. */
  actorName: string | null;
  /** Made through an API token (the personal agent, a script) rather than the site. */
  viaApiToken: boolean;
  systemJob: string | null;
  createdAt: string;
};

export type HouseholdActivityPage = {
  items: HouseholdActivityView[];
  nextCursor: string | null;
};
