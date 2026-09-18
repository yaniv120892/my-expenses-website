/**
 * How `scripts/import-statements.ts` prints a reconciliation preview, kept
 * apart from the script so it can be unit tested: the script runs on import.
 */
import { toDayString } from '../../src/shared/dates';
import type {
  ReconciliationMatch,
  ReconciliationPreviewItem,
  ReconciliationReviewHint,
} from '../../src/shared/types/import';

const ACTION_COLUMN_WIDTH = 8;
const CONTINUATION_INDENT = '\n            ';

export function describePlanItem(item: ReconciliationPreviewItem): string {
  const date = formatDate(item.date);
  const label = `${item.action}${item.reviewHint ? '?' : ''}`;
  const summary = `${label.padEnd(ACTION_COLUMN_WIDTH)}${date}  ${item.value.toFixed(2).padStart(9)}  ${item.description}`;
  const approves = item.match?.approvesPendingTransaction
    ? ' (approves pending)'
    : '';
  const details = [
    item.reviewHint ? `check: ${describeHint(item.reviewHint)}` : null,
    item.match ? describeMergeChanges(item, item.match, date) : null,
  ].filter((line) => line !== null && line !== '');

  return [`${summary}${approves}`, ...details].join(CONTINUATION_INDENT);
}

export function reviewReminder(
  items: ReconciliationPreviewItem[],
): string | null {
  // A server deployed before hints existed omits the field rather than nulling it.
  const flagged = items.filter((item) => item.reviewHint).length;
  if (flagged === 0) {
    return null;
  }
  return `${flagged} row(s) marked CREATE? or MERGE? above are close calls; review them before confirming.`;
}

/**
 * The fee rows the plan carries, printed apart from the table: they are
 * ordinary CREATE/MERGE rows, and the point is that nobody spots them in it.
 */
export function cardFeeNotice(
  items: ReconciliationPreviewItem[],
): string | null {
  // A server deployed before the flag existed omits the field rather than falsing it.
  const fees = items.filter((item) => item.cardHoldingFee);
  if (fees.length === 0) {
    return null;
  }

  const rows = fees.map(
    (item) =>
      `  ${formatDate(item.date)}  ${item.value.toFixed(2).padStart(9)}  ${item.description}`,
  );
  return [
    `${fees.length} row(s) are charges for holding the card, not spending; they can be cancelled by phoning the issuer:`,
    ...rows,
  ].join('\n');
}

function describeHint(hint: ReconciliationReviewHint): string {
  switch (hint.reason) {
    case 'unmatched-candidate': {
      const { description, value, date, status } = hint.counterpart;
      const approval = status === 'PENDING_APPROVAL' ? 'pending' : 'approved';
      const others =
        hint.candidateCount > 1 ? ` (+${hint.candidateCount - 1} more)` : '';
      return `not matched to "${description}" ${value.toFixed(2)} on ${formatDate(date)} (${approval})${others}`;
    }
    case 'unrelated-merge':
      return 'the merged descriptions share no word';
    default: {
      const unhandledHint: never = hint;
      throw new Error(`Unhandled review hint ${JSON.stringify(unhandledHint)}`);
    }
  }
}

function describeMergeChanges(
  item: ReconciliationPreviewItem,
  match: ReconciliationMatch,
  date: string,
): string {
  const { before } = match;
  const beforeDate = formatDate(before.date);
  return [
    before.description === item.description
      ? null
      : `description "${before.description}" -> "${item.description}"`,
    before.value === item.value
      ? null
      : `value ${before.value.toFixed(2)} -> ${item.value.toFixed(2)}`,
    beforeDate === date ? null : `date ${beforeDate} -> ${date}`,
  ]
    .filter((change) => change !== null)
    .join('; ');
}

/** Dates arrive as JSON strings even though the plan type names them Date. */
function formatDate(value: Date | string): string {
  return toDayString(new Date(value));
}
