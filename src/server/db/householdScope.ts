import { Prisma } from '@/generated/prisma/client';

// Every model, classified, so a new one fails to compile until someone decides
// whether its rows belong to a household. Invite and User carry a householdId
// but are looked up across households by design (a code is redeemed by an
// outsider; a member is resolved by id), and TransactionFile is reached only
// through a transaction already loaded in the household.
export const IS_HOUSEHOLD_OWNED = {
  Household: false,
  Invite: false,
  User: false,
  AnnouncementAck: false,
  UserNotificationPreference: false,
  UserNotificationProvider: false,
  Transaction: true,
  Import: true,
  ImportedTransaction: true,
  Category: false,
  ScheduledTransaction: true,
  TransactionFile: false,
  UserCategoryMapping: true,
  ApiToken: false,
  AutoApproveRule: true,
  DetectedSubscription: true,
} satisfies Record<Prisma.ModelName, boolean>;

type QueryArguments = {
  where?: unknown;
  data?: unknown;
  create?: unknown;
};

export class UnscopedHouseholdQueryError extends Error {}

/**
 * The runtime half of household scoping: a query on a household-owned model
 * must name one household as a plain value, at the top of its filter (or of a
 * compound unique key), and every row it creates must carry one. A household
 * query written without it throws instead of reading or writing across
 * households. Cross-household jobs use systemPrisma, which skips this check.
 */
export function assertHouseholdScoped({
  model,
  operation,
  args,
}: {
  model: string | undefined;
  operation: string;
  args: QueryArguments | undefined;
}): void {
  if (!isHouseholdOwnedModel(model)) {
    return;
  }
  const failure = scopeFailure(operation, args ?? {});
  if (failure) {
    throw new UnscopedHouseholdQueryError(
      `${model}.${operation} must be scoped to one household: ${failure}`,
    );
  }
}

export function householdScopeGuard() {
  return Prisma.defineExtension({
    name: 'household-scope-guard',
    query: {
      $allModels: {
        $allOperations: ({ model, operation, args, query }) => {
          assertHouseholdScoped({ model, operation, args });
          return query(args);
        },
      },
    },
  });
}

function isHouseholdOwnedModel(model: string | undefined): boolean {
  return Object.entries(IS_HOUSEHOLD_OWNED).some(([name, isOwned]) => isOwned && name === model);
}

function scopeFailure(operation: string, args: QueryArguments): string | null {
  switch (operation) {
    case 'create':
      return rowsWithoutHousehold([args.data]);
    case 'createMany':
    case 'createManyAndReturn':
      return rowsWithoutHousehold(Array.isArray(args.data) ? args.data : [args.data]);
    case 'upsert':
      return filterWithoutHousehold(args.where) ?? rowsWithoutHousehold([args.create]);
    default:
      return filterWithoutHousehold(args.where);
  }
}

function filterWithoutHousehold(where: unknown): string | null {
  return namesOneHousehold(where) ? null : 'its where names no householdId';
}

function rowsWithoutHousehold(rows: unknown[]): string | null {
  const isEveryRowScoped = rows.every((row) => isRecord(row) && isHouseholdValue(row.householdId));
  return isEveryRowScoped ? null : 'a row it creates carries no householdId';
}

function namesOneHousehold(where: unknown): boolean {
  if (!isRecord(where)) {
    return false;
  }
  if (isHouseholdValue(where.householdId)) {
    return true;
  }
  const compoundKeys = Object.entries(where).filter(([key]) =>
    key.split('_').includes('householdId'),
  );
  const isScopedByCompoundKey = compoundKeys.some(
    ([, value]) => isRecord(value) && isHouseholdValue(value.householdId),
  );
  const isScopedByConjunct = Array.isArray(where.AND) && where.AND.some(namesOneHousehold);
  return isScopedByCompoundKey || isScopedByConjunct;
}

function isHouseholdValue(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
