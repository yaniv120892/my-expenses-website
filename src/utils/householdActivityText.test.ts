import { describe, expect, it } from 'vitest';
import { createTranslator } from '@yaniv120892/my-ui';
import { HouseholdActivityAction } from '@/generated/prisma/enums';
import { messages } from '@/i18n/messages';
import type { T } from '@/i18n/useT.types';
import type { HouseholdActivityView } from '@/shared/types/householdActivity';
import { describeHouseholdActivity } from '@/utils/householdActivityText';

const englishT: T = createTranslator({ locale: 'en', messages: messages.en });
const hebrewT: T = createTranslator({ locale: 'he', messages: messages.he });

function entry(overrides: Partial<HouseholdActivityView>): HouseholdActivityView {
  return {
    id: 'activity-1',
    action: 'CREATE',
    entityType: 'TRANSACTION',
    entityId: 'row-1',
    summary: null,
    role: null,
    actorName: 'Dana',
    viaApiToken: false,
    systemJob: null,
    createdAt: '2026-10-30T12:00:00.000Z',
    ...overrides,
  };
}

describe('describeHouseholdActivity', () => {
  it('names a role in the reader’s language, never its stored value', () => {
    const joined = entry({ action: 'MEMBER_JOINED', entityType: 'MEMBER', role: 'EDITOR' });
    const changed = entry({
      action: 'ROLE_CHANGED',
      entityType: 'MEMBER',
      summary: 'Noa',
      role: 'VIEWER',
    });

    expect(describeHouseholdActivity({ item: joined, t: englishT }).sentence).toBe(
      'Dana joined the household as Editor',
    );
    expect(describeHouseholdActivity({ item: changed, t: englishT }).sentence).toBe(
      "Dana changed Noa's role to Viewer",
    );
    expect(describeHouseholdActivity({ item: joined, t: hebrewT }).sentence).toBe(
      'Dana הצטרף/ה למשק הבית בתור עורך',
    );
    expect(describeHouseholdActivity({ item: changed, t: hebrewT }).sentence).toBe(
      'Dana שינה/תה את התפקיד של Noa לצופה',
    );
  });

  it('words a system job as the app doing it, in a readable sentence', () => {
    const projected = entry({ actorName: null, systemJob: 'scheduled-transactions' });

    expect(describeHouseholdActivity({ item: projected, t: englishT }).sentence).toBe(
      'The app added a transaction',
    );
    expect(describeHouseholdActivity({ item: projected, t: hebrewT }).sentence).toBe(
      'האפליקציה הוסיף/ה עסקה',
    );
  });

  it('keeps a changed row’s own words as the detail', () => {
    const text = describeHouseholdActivity({
      item: entry({ action: 'DELETE', summary: 'Coffee' }),
      t: englishT,
    });
    expect(text).toEqual({ sentence: 'Dana deleted a transaction', detail: 'Coffee' });
  });

  it('says whose leaving revoked an API token', () => {
    const text = describeHouseholdActivity({
      item: entry({ action: 'API_TOKEN_REVOKED', entityType: 'API_TOKEN', summary: 'agent' }),
      t: englishT,
    });
    expect(text.sentence).toBe('Dana left the household, so their API token "agent" was revoked');
  });

  it('words a removal’s token revocation apart from a leave, naming who removed', () => {
    const item = entry({
      action: 'API_TOKEN_REVOKED_ON_REMOVAL',
      entityType: 'API_TOKEN',
      summary: 'agent',
    });
    expect(describeHouseholdActivity({ item, t: englishT }).sentence).toBe(
      'The API token "agent" was revoked, because Dana removed the member who created it',
    );
    expect(describeHouseholdActivity({ item, t: hebrewT }).sentence).toBe(
      'אסימון ה-API "agent" בוטל, כי Dana הסיר/ה את החבר/ה שיצר/ה אותו',
    );
  });

  it.each(Object.values(HouseholdActivityAction))(
    'words %s with no stored enum value or field name in either language',
    (action) => {
      const item = entry({ action, summary: 'Noa', role: 'EDITOR' });
      for (const t of [englishT, hebrewT]) {
        const { sentence } = describeHouseholdActivity({ item, t });
        expect(sentence).not.toMatch(/\b(OWNER|EDITOR|VIEWER)\b|[A-Z]+_[A-Z]+|household\.|\{/);
      }
    },
  );
});
