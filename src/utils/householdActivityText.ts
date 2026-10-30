import type { HouseholdRole } from '@/generated/prisma/enums';
import type { T } from '@/i18n/useT.types';
import type { HouseholdActivityView } from '@/shared/types/householdActivity';

type ActivityText = {
  sentence: string;
  /** The changed row's own words (a description, a file name), shown beside the time. */
  detail: string | null;
};

export function describeHouseholdActivity({
  item,
  t,
}: {
  item: HouseholdActivityView;
  t: T;
}): ActivityText {
  const actor = actorName({ item, t });
  const name = item.summary ?? '';
  switch (item.action) {
    case 'CREATE':
    case 'UPDATE':
    case 'DELETE':
    case 'APPROVE':
    case 'MERGE':
    case 'IGNORE':
    case 'CONFIRM':
    case 'DISMISS':
    case 'DETECT':
      return {
        sentence: t(`household.activity.sentence.${item.action}`, {
          actor,
          entity: t(`household.activity.entity.${item.entityType}`),
        }),
        detail: item.summary,
      };
    case 'INVITE_CREATED':
    case 'MEMBER_JOINED':
      return {
        sentence: t(`household.activity.sentence.${item.action}`, {
          actor,
          role: roleName({ role: item.role, t }),
        }),
        detail: null,
      };
    case 'ROLE_CHANGED':
      return {
        sentence: t('household.activity.sentence.ROLE_CHANGED', {
          actor,
          name,
          role: roleName({ role: item.role, t }),
        }),
        detail: null,
      };
    case 'INVITE_REVOKED':
    case 'MEMBER_LEFT':
      return { sentence: t(`household.activity.sentence.${item.action}`, { actor }), detail: null };
    case 'MEMBER_REMOVED':
      return {
        sentence: t('household.activity.sentence.MEMBER_REMOVED', { actor, name }),
        detail: null,
      };
    case 'API_TOKEN_REVOKED':
    case 'API_TOKEN_REVOKED_ON_REMOVAL':
      return {
        sentence: t(`household.activity.sentence.${item.action}`, { actor, name }),
        detail: null,
      };
    default:
      throw new Error(`Unhandled activity action: ${item.action satisfies never}`);
  }
}

function actorName({ item, t }: { item: HouseholdActivityView; t: T }): string {
  if (item.actorName) {
    return item.actorName;
  }
  return item.systemJob ? t('household.activity.system') : t('household.activity.formerMember');
}

function roleName({ role, t }: { role: HouseholdRole | null; t: T }): string {
  return role ? t(`household.role.${role}`) : '';
}
