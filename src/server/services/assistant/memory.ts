import { Memory } from '@mastra/memory';
import { PostgresStore } from '@mastra/pg';
import logger from '@/server/logging/logger';

// Mastra needs a direct Postgres connection — DATABASE_URL is a prisma://
// Accelerate URL that node-postgres cannot open.
function connectionString(): string {
  return process.env.MASTRA_DB_URL || process.env.DIRECT_URL || '';
}

const MASTRA_SCHEMA = 'mastra';

let memory: Memory | undefined;
let warned = false;

/**
 * The shared Memory instance, or undefined when no direct connection is
 * configured — the assistant then degrades to stateless chat.
 */
export function getAssistantMemory(): Memory | undefined {
  const url = connectionString();
  if (!url) {
    if (!warned) {
      warned = true;
      logger.warn(
        'Assistant memory disabled: set MASTRA_DB_URL or DIRECT_URL to persist conversation threads',
      );
    }
    return undefined;
  }

  memory ??= new Memory({
    storage: new PostgresStore({
      id: 'assistant-memory',
      connectionString: url,
      // Keeps Mastra's self-managed tables out of `public` so they never
      // collide with the Prisma schema or show up as migration drift.
      schemaName: MASTRA_SCHEMA,
    }),
  });
  return memory;
}

export function isMemoryEnabled(): boolean {
  return Boolean(connectionString());
}

// Threads are keyed per user so history is recalled across sessions/devices.
export function getThreadId(userId: string): string {
  return `financial-assistant:${userId}`;
}
