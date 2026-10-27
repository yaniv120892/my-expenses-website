import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import transactionService from '@/server/services/transactionService';
import scheduledTransactionService from '@/server/services/scheduledTransactionService';
import categoryRepository from '@/server/repositories/categoryRepository';
import { formatCurrencyPlain, translateToScheduleSummary } from '@/utils/format';
import { toDayString } from '@/shared/dates';
import type { ScheduledTransactionDomain } from '@/shared/types/scheduledTransaction';
import { READ_ONLY, registerSafeTool } from '@/server/mcp/safeTool';
import { describeTransactions } from '@/server/mcp/transactionText';
import type { McpActor } from '@/server/mcp/createMcpServer.types';

export function registerScheduleTools({
  server,
  actor,
}: {
  server: McpServer;
  actor: McpActor;
}): void {
  const { userId } = actor;

  registerSafeTool({
    server,
    actor,
    name: 'list_pending_transactions',
    config: {
      title: 'List pending transactions',
      description:
        'Lists transactions waiting for the user to approve in the app — the ones recurring schedules have projected. They are not counted in any total until approved.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    handler: async () =>
      describeTransactions({
        transactions: await transactionService.getPendingTransactions(userId),
        emptyText: 'Nothing is waiting for approval.',
      }),
  });

  registerSafeTool({
    server,
    actor,
    name: 'list_scheduled_transactions',
    config: {
      title: 'List recurring transactions',
      description:
        'Lists the recurring transactions (rent, salary, subscriptions) the user has scheduled, with how often each runs and when it next runs. Scheduled amounts are in ILS.',
      inputSchema: {},
      annotations: READ_ONLY,
    },
    handler: async () => {
      const [schedules, categories] = await Promise.all([
        scheduledTransactionService.listScheduledTransactions(userId),
        categoryRepository.getAllCategories(),
      ]);
      if (schedules.length === 0) {
        return 'No recurring transactions are scheduled.';
      }
      const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
      return schedules
        .map((schedule) =>
          describeSchedule({
            schedule,
            categoryName: categoryNames.get(schedule.categoryId),
          }),
        )
        .join('\n');
    },
  });
}

function describeSchedule({
  schedule,
  categoryName,
}: {
  schedule: ScheduledTransactionDomain;
  categoryName: string | undefined;
}): string {
  return [
    schedule.description,
    formatCurrencyPlain(schedule.value),
    categoryName ?? 'Uncategorized',
    schedule.type,
    translateToScheduleSummary(
      schedule.scheduleType,
      schedule.interval,
      schedule.dayOfWeek,
      schedule.dayOfMonth,
    ),
    schedule.nextRunDate ? `next ${toDayString(schedule.nextRunDate)}` : 'no next run',
  ].join(' | ');
}
