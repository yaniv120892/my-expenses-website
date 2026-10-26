import { describe, expect, it } from 'vitest';
import { commonMessages as sharedMessages } from '@yaniv120892/my-ui';
import { messageAreas, messages } from './index';

describe('messages', () => {
  it.each(Object.entries(messageAreas))(
    '%s has the same keys in Hebrew and English',
    (_area, dictionary) => {
      expect(Object.keys(dictionary.he).sort()).toEqual(
        Object.keys(dictionary.en).sort(),
      );
    },
  );

  it('gives every key a non-empty Hebrew and English text', () => {
    for (const locale of ['en', 'he'] as const) {
      const empty = Object.entries(messages[locale])
        .filter(([, text]) => text.trim() === '')
        .map(([key]) => key);
      expect(empty, locale).toEqual([]);
    }
  });

  it('never defines a key in two areas or over a shared shell key', () => {
    const owners = new Map<string, string[]>();
    for (const key of Object.keys(sharedMessages.en)) {
      owners.set(key, ['my-ui']);
    }
    for (const [area, dictionary] of Object.entries(messageAreas)) {
      for (const key of Object.keys(dictionary.en)) {
        owners.set(key, [...(owners.get(key) ?? []), area]);
      }
    }
    const duplicates = [...owners].filter(([, areas]) => areas.length > 1);
    expect(duplicates).toEqual([]);
  });

  it('keeps the same placeholders in both languages', () => {
    const placeholders = (text: string) =>
      [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    const hebrew: Record<string, string> = messages.he;
    const mismatched = Object.entries(messages.en)
      .filter(
        ([key, text]) =>
          placeholders(text).join() !== placeholders(hebrew[key]).join(),
      )
      .map(([key]) => key);
    expect(mismatched).toEqual([]);
  });
});
