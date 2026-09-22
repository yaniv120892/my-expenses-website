import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { SignJWT } from 'jose';
import { ANNOUNCEMENT_IDS } from '@/shared/announcements';

// User A's figures make the comparison exact (Jan ₪4,100 → Feb ₪5,200: +₪1,100,
// +26.83%); user B exists so a check can assert A's answers never contain B's.

// Hashed, so a local run can sign in through the login form.
export const SEED_PASSWORD = 'local-dev-password';

export interface SeededUser {
  id: string;
  email: string;
  token: string;
}

export interface SeedResult {
  userA: SeededUser;
  userB: SeededUser;
}

// Deliberately carries no encryption extension, so what it writes is whatever
// it was handed. `pgbouncer=true` disables prepared statements for pooled hosts.
function directClient(): PrismaClient {
  const base = process.env.DIRECT_URL || '';
  const url = base.includes('pgbouncer=true')
    ? base
    : `${base}${base.includes('?') ? '&' : '?'}pgbouncer=true`;

  return new PrismaClient({ datasources: { db: { url } } });
}

function mintToken(userId: string, expiresIn = '1h'): Promise<string> {
  const secret = new TextEncoder().encode(
    process.env.JWT_SECRET || 'e2e-test-secret',
  );
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

const LOCAL_DATABASE_HOSTS = ['127.0.0.1', 'localhost', '::1', '[::1]'];

export function assertSeedTargetIsLocal(directUrl: string): void {
  let host: string;
  try {
    host = new URL(directUrl).hostname;
  } catch {
    throw new Error(
      `DIRECT_URL is not a URL, refusing to seed: "${directUrl}"`,
    );
  }
  if (!LOCAL_DATABASE_HOSTS.includes(host)) {
    throw new Error(
      `Refusing to seed: DIRECT_URL points at ${host}, and the seed wipes every table. Only a database on ${LOCAL_DATABASE_HOSTS.join('/')} may be seeded.`,
    );
  }
}

// Twelve hours rather than the seed's one: an import over many statements
// outlives an hour.
export async function sessionForExistingUser(
  email: string,
): Promise<SeededUser> {
  const prisma = directClient();

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error(
        `No user with email ${email} in the database DIRECT_URL points at`,
      );
    }
    return {
      id: user.id,
      email: user.email,
      token: await mintToken(user.id, '12h'),
    };
  } finally {
    await prisma.$disconnect();
  }
}

export async function seed(): Promise<SeedResult> {
  assertSeedTargetIsLocal(process.env.DIRECT_URL || '');
  const prisma = directClient();

  try {
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

    const passwordHash = await hash(SEED_PASSWORD, 10);
    const userA = await prisma.user.create({
      data: {
        username: 'e2e-user-a',
        email: 'a@e2e.test',
        password: passwordHash,
        verified: true,
      },
    });
    const userB = await prisma.user.create({
      data: {
        username: 'e2e-user-b',
        email: 'b@e2e.test',
        password: passwordHash,
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
        tx(userA.id, 4000, '2026-01-05', groceries.id, 'Weekly shop'),
        tx(userA.id, 100, '2026-01-09', groceries.id, 'Corner store'),
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

export const USER_B_MARKERS = ['7,777', '8,888', '16,665'];
