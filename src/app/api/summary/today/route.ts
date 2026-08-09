import { createHandler } from '@/server/http/handler';
import TransactionNotifierFactory from '@/server/services/transactionNotification/transactionNotifierFactory';
import AIServiceFactory from '@/server/services/ai/aiServiceFactory';
import transactionService from '@/server/services/transactionService';
import userSettingsService from '@/server/services/userSettingsService';

interface SummaryTransaction {
  description?: string | null;
  value: number;
  category?: { name: string } | null;
}

async function getAllTodayTransactions(userId: string) {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );

  return transactionService.getAllTransactions({
    startDate: startOfToday,
    endDate: endOfToday,
    userId,
  });
}

function formatTransactionList(transactions: SummaryTransaction[]) {
  return transactions
    .map((transaction) => {
      const description = transaction.description || '';
      const category = transaction.category?.name || '';
      const amount = transaction.value || 0;
      return `${category}, ${description}, ${amount} ש״ח`;
    })
    .join('\n');
}

function formatSummaryMessage(
  transactions: SummaryTransaction[],
  totalAmount: number,
  aiInsights: string,
) {
  return [
    '*ההוצאות של היום:*',
    formatTransactionList(transactions),
    '',
    `*סך הכל הוצאות:*\n${totalAmount} ש״ח\n`,
    '',
    `*סיכום:*\n${aiInsights}`,
  ].join('\n');
}

async function getSummaryMessage(userId: string) {
  const transactions = await getAllTodayTransactions(userId);
  if (transactions.length === 0) {
    return 'לא נוספו הוצאות היום.';
  }
  const transactionsTextForAiAnalyzer = transactions
    .map(
      (t: SummaryTransaction) =>
        `description:${t.description}, category: ${t.category?.name}, amount: ${t.value}`,
    )
    .join('\n');
  const aiInsights = await AIServiceFactory.getAIService().analyzeExpenses(
    transactionsTextForAiAnalyzer,
    'add a funny summary based on my expenses at the end',
  );
  const total = transactions.reduce(
    (sum: number, t: SummaryTransaction) => sum + t.value,
    0,
  );
  return formatSummaryMessage(transactions, total, aiInsights);
}

export const GET = createHandler({
  auth: 'cron',
  handler: async () => {
    const notifier = TransactionNotifierFactory.getNotifier();
    const users = await userSettingsService.getUsersRequiredDailySummary();
    for (const userId of users) {
      const fullSummaryMessage = await getSummaryMessage(userId);
      await notifier.sendDailySummary(fullSummaryMessage, userId);
    }
  },
});
