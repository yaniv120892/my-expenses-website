import { formatCurrencyPlain } from '@/utils/format';
import { escapeMarkdown } from '@/server/services/telegramService';

export interface SummaryTransaction {
  description?: string | null;
  value: number;
  category?: { name: string } | null;
}

/**
 * The template's bold markers are the only intended Markdown; everything
 * user- or model-originated is escaped so Telegram cannot reject the send.
 */
export function formatSummaryMessage(
  transactions: SummaryTransaction[],
  totalAmount: number,
  aiInsights: string,
): string {
  const list = transactions
    .map(
      (t) =>
        `${escapeMarkdown(t.category?.name || '')}, ${escapeMarkdown(t.description || '')}, ${formatCurrencyPlain(t.value || 0)}`,
    )
    .join('\n');
  return [
    '*ההוצאות של היום:*',
    list,
    '',
    `*סך הכל הוצאות:*\n${formatCurrencyPlain(totalAmount)}\n`,
    '',
    `*סיכום:*\n${escapeMarkdown(aiInsights)}`,
  ].join('\n');
}
