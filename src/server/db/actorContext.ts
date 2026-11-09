import { AsyncLocalStorage } from 'node:async_hooks';
import type { HouseholdActor } from '@/server/auth/householdActor.types';
import type { ScopedTransactionClient } from '@/server/db/client';

/**
 * Who the current request or job acts as, and the database transaction its
 * activity record is joining, if any. Carried implicitly so that every write
 * made on a member's behalf is attributed (src/server/db/attribution.ts)
 * without each repository being handed the actor, and so that a repository
 * call inside `householdActivityService.record` joins its transaction.
 */
export type ActorContext = {
  actor: HouseholdActor;
  transaction?: ScopedTransactionClient;
};

const storage = new AsyncLocalStorage<ActorContext>();

export function runAsActor<Result>(actor: HouseholdActor, work: () => Result): Result {
  return storage.run({ actor }, work);
}

export function runInTransaction<Result>(
  { actor, transaction }: { actor: HouseholdActor; transaction: ScopedTransactionClient },
  work: () => Result,
): Result {
  return storage.run({ actor, transaction }, work);
}

export function currentActorContext(): ActorContext | undefined {
  return storage.getStore();
}
