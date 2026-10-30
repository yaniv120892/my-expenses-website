import { Prisma } from '@/generated/prisma/client';
import type { HouseholdActor } from '@/server/auth/householdActor.types';
import { currentActorContext } from '@/server/db/actorContext';
import { isHouseholdOwnedModel } from '@/server/db/householdScope';

type WriteStamp = {
  created: Record<string, string | boolean>;
  updated: Record<string, string>;
};

/**
 * Stamps `createdById` and `updatedById` on every household-owned row a
 * member's request writes, whichever path the write takes. A system job marks
 * the rows it creates `createdBySystem` and leaves a row it updates alone, so
 * that row keeps the member who last edited it.
 */
export function attributionStamp() {
  return Prisma.defineExtension({
    name: 'household-attribution',
    query: {
      $allModels: {
        $allOperations: ({ model, operation, args, query }) => {
          const actor = currentActorContext()?.actor;
          if (!actor || !isAttributedModel(model)) {
            return query(args);
          }
          return query(stampWrite({ operation, args, stamp: stampFor(actor) }));
        },
      },
    },
  });
}

export function stampFor(actor: HouseholdActor): WriteStamp {
  switch (actor.kind) {
    case 'member':
      return { created: { createdById: actor.userId }, updated: { updatedById: actor.userId } };
    case 'system':
      return { created: { createdBySystem: true }, updated: {} };
    default:
      throw new Error(`Unhandled actor kind: ${actor satisfies never}`);
  }
}

export function stampWrite<Arguments extends object>({
  operation,
  args,
  stamp: { created, updated },
}: {
  operation: string;
  args: Arguments;
  stamp: WriteStamp;
}): Arguments {
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
