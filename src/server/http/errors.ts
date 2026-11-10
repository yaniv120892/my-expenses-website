import type { ZodError } from 'zod';

type JsonErrorBody = { message: string } | { error: string; message: string; code: string };

/** `code` is a stable, machine-readable reason a client can localize instead of `message`. */
export class HttpError extends Error {
  public constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}

export function jsonErrorBody({
  message,
  code,
}: {
  message: string;
  code?: string;
}): JsonErrorBody {
  return code ? { error: message, message, code } : { message };
}

export function formatZodIssues(err: ZodError): string {
  return err.issues
    .map((issue) =>
      issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
    )
    .join('; ');
}
