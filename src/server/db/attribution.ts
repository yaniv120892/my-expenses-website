import { Prisma } from '@/generated/prisma/client';
import { currentActorContext } from '@/server/db/actorContext';
import { isHouseholdOwnedModel } from '@/server/db/householdScope';

/**
 * Stamps `createdById` and `updatedById` on every household-owned row a
 * member's request writes, whichever path the write takes. A system job
 * stamps nothing, so its rows read as made by no member and a row it touches
 * keeps the member who last edited it.
 */
export function attributionStamp() {
  return Prisma.defineExtension({
    name: 'household-attribution',
    query: {
      $allModels: {
        $allOperations: ({ model, operation, args, query }) => {
          const actor = currentActorContext()?.actor;
          if (actor?.kind !== 'member' || !isAttributedModel(model)) {
            return query(args);
          }
          return query(stampWrite({ operation, args, userId: actor.userId }));
        },
      },
    },
  });
}

export function stampWrite<Arguments extends object>({
  operation,
  args,
  userId,
}: {
  operation: string;
  args: Arguments;
  userId: string;
}): Arguments {
  const created = { createdById: userId };
  const updated = { updatedById: userId };
  const data = field(args, 'data');
  switch (operation) {
    case 'create':
      return { ...args, data: { ...asObject(data), ...created } };
    case 'createMany':
    case 'createManyAndReturn':
      return {
        ...args,
        data: Array.isArray(data)
          ? data.map((row) => ({ ...asObject(row), ...created }))
          : { ...asObject(data), ...created },
      };
    case 'update':
    case 'updateMany':
    case 'updateManyAndReturn':
      return { ...args, data: { ...asObject(data), ...updated } };
    case 'upsert':
      return {
        ...args,
        create: { ...asObject(field(args, 'create')), ...created },
        update: { ...asObject(field(args, 'update')), ...updated },
      };
    default:
      return args;
  }
}

// Every household-owned model but the activity log, which is itself the record.
function isAttributedModel(model: string | undefined): boolean {
  return isHouseholdOwnedModel(model) && model !== Prisma.ModelName.HouseholdActivity;
}

function field(args: object, name: string): unknown {
  return name in args ? Reflect.get(args, name) : undefined;
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? { ...value } : {};
}
