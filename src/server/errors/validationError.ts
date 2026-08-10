import { HttpError } from '@/server/http/errors';

export class CustomValidationError extends HttpError {
  constructor(message: string) {
    super(400, message);
  }
}
