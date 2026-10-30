import type {
  HouseholdActivityAction,
  HouseholdEntityType,
  Prisma,
} from '@/generated/prisma/client';
import type { HouseholdActor, HouseholdId } from '@/server/auth/householdActor.types';
import { runInTransaction } from '@/server/db/actorContext';
import prisma from '@/server/db/client';
import householdActivityRepository from '@/server/repositories/householdActivityRepository';
import type { HouseholdActivityRow } from '@/server/repositories/householdActivityRepository';
import type { HouseholdActivityPage } from '@/shared/types/householdActivity';

export type ActivityEntry = {
  action: HouseholdActivityAction;
  entityType: HouseholdEntityType;
  entityId: string;
  summary: string;
  /** The actor's household unless named: a member who joins is recorded in the one they join. */
  householdId?: HouseholdId;
};

type ActivityDescription = ActivityEntry | ActivityEntry[] | null;

class HouseholdActivityService {
  /**
   * The one way a household write is recorded: `write` runs in a database
   * transaction, every repository call inside it joins that transaction
   * (src/server/db/client.ts), and the activity rows `describe` returns are
   * appended before it commits, so a change and its record land together or
   * not at all. Keep slow work (model calls, storage, notifications) outside
   * `write`; the transaction holds the instance's one connection.
   */
  public async record<Result>({
    actor,
    write,
    describe,
  }: {
    actor: HouseholdActor;
    write: () => Promise<Result>;
    describe: (result: Result) => ActivityDescription;
  }): Promise<Result> {
    return prisma.$transaction(async (transaction) =>
      runInTransaction({ actor, transaction }, async () => {
        const result = await write();
        await householdActivityRepository.append(this.toRows(actor, describe(result)));
        return result;
      }),
    );
  }

  public async listPage({
    householdId,
    cursor,
    limit,
  }: {
    householdId: HouseholdId;
    cursor: string | undefined;
    limit: number;
  }): Promise<HouseholdActivityPage> {
    const rows = await householdActivityRepository.findPage({
      householdId,
      cursor,
      limit: limit + 1,
    });
    const page = rows.slice(0, limit);
    return {
      items: page.map((row) => this.toView(row)),
      nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null,
    };
  }

  private toRows(
    actor: HouseholdActor,
    description: ActivityDescription,
  ): Prisma.HouseholdActivityCreateManyInput[] {
    const entries = description === null ? [] : [description].flat();
    return entries.map(({ householdId, ...entry }) => ({
      ...entry,
      householdId: householdId ?? actor.householdId,
      ...this.actorColumns(actor),
    }));
  }

  private actorColumns(actor: HouseholdActor) {
    switch (actor.kind) {
      case 'member':
        return { actorUserId: actor.userId, actorTokenId: actor.apiTokenId, systemJob: null };
      case 'system':
        return { actorUserId: null, actorTokenId: null, systemJob: actor.job };
      default:
        throw new Error(`Unhandled actor kind: ${actor satisfies never}`);
    }
  }

  private toView(row: HouseholdActivityRow) {
    return {
      id: row.id,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      summary: row.summary,
      actorName: row.actorUser?.username ?? null,
      viaApiToken: row.actorTokenId !== null,
      systemJob: row.systemJob,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

const householdActivityService = new HouseholdActivityService();
export default householdActivityService;
