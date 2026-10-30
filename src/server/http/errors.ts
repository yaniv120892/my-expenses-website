import type { ZodError } from 'zod';

/** `code` is a stable, machine-readable reason a client can localize instead of `message`. */
export class HttpError extends Error {
  public constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export function formatZodIssues(err: ZodError): string {
  return err.issues
    .map((issue) =>
      issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
    )
    .join('; ');
}
