import { describe, expect, it } from 'vitest';
import {
  AxiosError,
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import { createTranslator } from '@yaniv120892/my-ui';
import { messages } from '@/i18n/messages';
import type { T } from '@/i18n/useT.types';
import { HOUSEHOLD_ERROR_CODES } from '@/shared/types/household';
import { describeHouseholdError, householdErrorCode } from '@/utils/householdError';

const englishT: T = createTranslator({ locale: 'en', messages: messages.en });
const hebrewT: T = createTranslator({ locale: 'he', messages: messages.he });

function axiosErrorWith({ status, data }: { status: number; data: unknown }): AxiosError {
  const config: InternalAxiosRequestConfig = { headers: new AxiosHeaders() };
  const response: AxiosResponse = { status, statusText: '', headers: {}, config, data };
  return new AxiosError(
    `Request failed with status code ${status}`,
    String(status),
    config,
    null,
    response,
  );
}

describe('householdErrorCode', () => {
  it('reads a known code from the body beside the message', () => {
    const error = axiosErrorWith({
      status: 409,
      data: { error: 'Conflict', message: 'English text', code: 'HOUSEHOLD_IN_USE' },
    });

    expect(householdErrorCode(error)).toBe('HOUSEHOLD_IN_USE');
  });

  it('ignores a code that is not a household refusal', () => {
    const error = axiosErrorWith({
      status: 401,
      data: { error: 'Unauthorized', message: 'nope', code: 'API_TOKEN_REQUIRED' },
    });

    expect(householdErrorCode(error)).toBeNull();
  });

  it('is null for a body with no code, or an error that is not a request', () => {
    expect(householdErrorCode(axiosErrorWith({ status: 500, data: { message: 'x' } }))).toBeNull();
    expect(householdErrorCode(new Error('boom'))).toBeNull();
  });
});

describe('describeHouseholdError', () => {
  it('shows a coded refusal in the reader language, never the server English', () => {
    const error = axiosErrorWith({
      status: 403,
      data: { error: 'Forbidden', message: 'server English', code: 'NOT_HOUSEHOLD_OWNER' },
    });
    error.message = 'server English';

    const english = describeHouseholdError({ error, fallback: 'fallback', t: englishT });
    const hebrew = describeHouseholdError({ error, fallback: 'fallback', t: hebrewT });

    expect(english).toBe(englishT('household.error.NOT_HOUSEHOLD_OWNER'));
    expect(hebrew).toBe(hebrewT('household.error.NOT_HOUSEHOLD_OWNER'));
    expect(hebrew).not.toBe(english);
  });

  it('has text for every household refusal code', () => {
    for (const code of HOUSEHOLD_ERROR_CODES) {
      const error = axiosErrorWith({ status: 400, data: { message: 'x', code } });
      expect(describeHouseholdError({ error, fallback: 'fallback', t: englishT })).not.toMatch(
        /household\.error|[A-Z]{3,}_[A-Z]/,
      );
    }
  });

  it('falls back to the uncoded message, and past axios generic text to the fallback', () => {
    const withMessage = axiosErrorWith({ status: 400, data: { message: 'Readable' } });
    withMessage.message = 'Readable';
    const generic = axiosErrorWith({ status: 500, data: null });

    expect(describeHouseholdError({ error: withMessage, fallback: 'fb', t: englishT })).toBe(
      'Readable',
    );
    expect(describeHouseholdError({ error: generic, fallback: 'fb', t: englishT })).toBe('fb');
  });
});
