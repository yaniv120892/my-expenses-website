import { ApiResponse } from '../types';

function isApiResponseError(obj: unknown): obj is ApiResponse<unknown> {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'success' in obj &&
    'error' in obj
  );
}

export function handleApiError(
  error: unknown,
  fallback = 'An unknown error occurred',
): string {
  if (isApiResponseError(error)) {
    return error.error || fallback;
  } else if (error instanceof Error) {
    return error.message || fallback;
  } else {
    return fallback;
  }
}

function isAxiosGenericMessage(message: string): boolean {
  return (
    message === 'Network Error' ||
    message.startsWith('Request failed with status code') ||
    message.startsWith('timeout of ')
  );
}

/** Axios's generic messages are not user-facing, so they give way to the fallback. */
export function describeApiError(error: unknown, fallback: string): string {
  const message = handleApiError(error, fallback);
  return isAxiosGenericMessage(message) ? fallback : message;
}
