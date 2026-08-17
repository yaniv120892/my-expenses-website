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
