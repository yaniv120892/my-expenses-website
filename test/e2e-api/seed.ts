import { PrismaClient } from '@prisma/client';
import { SignJWT } from 'jose';
import { ANNOUNCEMENT_IDS } from '@/shared/announcements';

/**
 * Seeds two users with deliberately distinct amounts.
 *
 * User A's figures are chosen so the expected comparison output is exact:
 *   January ₪4,100.00, February ₪5,200.00 → +₪1,100.00, +26.83%
 *
 * User B exists purely so a test can assert that A's answers never contain B's
 * numbers — the check behind the claim that userId is server-injected.
 */

export interface SeededUser {
  id: string;
  email: string;
  token: string;
}

export interface SeedResult {
  userA: SeededUser;
  userB: SeededUser;
}

// A direct (non-Accelerate) client: the seed talks to Postgres straight,
// independently of the app's edge client. `pgbouncer=true` disables prepared
// statements, which collide when a pooler reuses sessions.
function directClient(): PrismaClient {
  const base = process.env.DIRECT_URL || '';
  const url = base.includes('pgbouncer=true')
    ? base
    : `${base}${base.includes('?') ? '&' : '?'}pgbouncer=true`;

  return new PrismaClient({ datasources: { db: { url } } });
}

function mintToken(userId: string): Promise<string> {
  const secret = new TextEncoder().encode(
    process.env.JWT_SECRET || 'e2e-test-secret',
  );
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secret);
}

export async function seed(): Promise<SeedResult> {
  const prisma = directClient();

  try {
    // Order matters: dependents first, then categories and users.
    await prisma.announcementAck.deleteMany({});
    await prisma.detectedSubscription.deleteMany({});
    await prisma.scheduledTransaction.deleteMany({});
    // Imported rows point at both an import and a transaction, so they go
    // before either. The imports e2e leaves these behind.
    await prisma.importedTransaction.deleteMany({});
    await prisma.import.deleteMany({});
    await prisma.transaction.deleteMany({});
    await prisma.category.deleteMany({});
    await prisma.user.deleteMany({});

    const groceries = await prisma.category.create({
      data: { name: 'Groceries' },
    });
    const rent = await prisma.category.create({ data: { name: 'Rent' } });

    const userA = await prisma.user.create({
      data: {
        username: 'e2e-user-a',
        email: 'a@e2e.test',
        password: 'x',
        verified: true,
      },
    });
    const userB = await prisma.user.create({
      data: {
        username: 'e2e-user-b',
        email: 'b@e2e.test',
        password: 'x',
        verified: true,
      },
    });

    // Signup acknowledges every existing announcement, but these users are
    // created straight through Prisma. Without this the What's New dialog
    // opens over the first page a spec visits and hides it.
    await prisma.announcementAck.createMany({
      data: [userA.id, userB.id].flatMap((userId) =>
        ANNOUNCEMENT_IDS.map((announcementId) => ({ userId, announcementId })),
      ),
    });

    const tx = (
      userId: string,
      value: number,
      date: string,
      categoryId: string,
      description: string,
    ) => ({
      userId,
      value,
      date: new Date(date),
      categoryId,
      description,
      type: 'EXPENSE' as const,
      status: 'APPROVED' as const,
    });

    await prisma.transaction.createMany({
      data: [
        // User A — January 4,000 + 100 = 4,100
        tx(userA.id, 4000, '2026-01-05', groceries.id, 'Weekly shop'),
        tx(userA.id, 100, '2026-01-09', groceries.id, 'Corner store'),
        // User A — February 5,200
        tx(userA.id, 5200, '2026-02-05', groceries.id, 'Monthly shop'),
        // User A — a second category, for percentage-share checks
        tx(userA.id, 900, '2026-01-15', rent.id, 'Rent'),

        // User B — amounts that must never surface in user A's answers
        tx(userB.id, 7777, '2026-01-07', groceries.id, 'B groceries'),
        tx(userB.id, 8888, '2026-02-07', groceries.id, 'B groceries'),
      ],
    });

    return {
      userA: {
        id: userA.id,
        email: userA.email,
        token: await mintToken(userA.id),
      },
      userB: {
        id: userB.id,
        email: userB.email,
        token: await mintToken(userB.id),
      },
    };
  } finally {
    await prisma.$disconnect();
  }
}

/** Amounts that belong to user B and must never appear in user A's stream. */
export const USER_B_MARKERS = ['7,777', '8,888', '16,665'];
