import { HttpError } from '@/server/http/errors';

export class CustomValidationError extends HttpError {
  public constructor(message: string) {
    super(400, message);
  }
}
