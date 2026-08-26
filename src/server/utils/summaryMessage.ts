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
  aiInsights: string | null,
): string {
  const list = transactions
    .map(
      (t) =>
        `${escapeMarkdown(t.category?.name || '')}, ${escapeMarkdown(t.description || '')}, ${formatCurrencyPlain(t.value || 0)}`,
    )
    .join('\n');
  const sections = [
    '*ההוצאות של היום:*',
    list,
    '',
    `*סך הכל הוצאות:*\n${formatCurrencyPlain(totalAmount)}\n`,
  ];
  // No insights means the provider failed, which is not worth telling the user
  // about in their daily summary — the section simply does not appear.
  if (aiInsights) {
    sections.push('', `*סיכום:*\n${escapeMarkdown(aiInsights)}`);
  }
  return sections.join('\n');
}
