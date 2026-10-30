import { HttpError } from '@/server/http/errors';
import type { HouseholdErrorCode } from '@/shared/types/household';

/** An HttpError whose code is one the client knows how to localize. */
export class HouseholdRefusal extends HttpError {
  public constructor({
    status,
    message,
    code,
  }: {
    status: number;
    message: string;
    code: HouseholdErrorCode;
  }) {
    super(status, message, code);
  }
}
