import { describe, expect, it } from 'vitest';
import { createTranslator } from '@yaniv120892/my-ui';
import { messages } from '@/i18n/messages';
import type { T } from '@/i18n/useT.types';
import { AuthRequestError } from '@/services/authClient';
import { authErrorMessage } from '@/utils/authErrorMessage';

const englishT: T = createTranslator({ locale: 'en', messages: messages.en });
const hebrewT: T = createTranslator({ locale: 'he', messages: messages.he });

describe('authErrorMessage', () => {
  it('reads unsendable mail in the user language rather than the server text', () => {
    const error = new AuthRequestError({ status: 503, serverMessage: 'Email could not be sent.' });

    expect(authErrorMessage({ error, fallback: 'fallback', t: englishT })).toBe(
      "We couldn't send the email right now. Please try again later.",
    );
    expect(authErrorMessage({ error, fallback: 'fallback', t: hebrewT })).toBe(
      'לא הצלחנו לשלוח את המייל כרגע. נסו שוב מאוחר יותר.',
    );
  });
});
