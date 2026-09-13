/**
 * How `scripts/import-statements.ts` prints a reconciliation preview, kept
 * apart from the script so it can be unit tested: the script runs on import.
 */
import { toDayString } from '../../src/shared/dates';
import type {
  ReconciliationCounterpart,
  ReconciliationPreviewItem,
} from '../../src/shared/types/import';

const CONTINUATION_INDENT = '\n            ';

export function describePlanItem(item: ReconciliationPreviewItem): string {
  const date = formatDate(item.date);
  const summary = `${date}  ${item.value.toFixed(2).padStart(9)}  ${item.description}`;
  const hint = item.reviewHint;

  if (item.action === 'CREATE' || !item.match) {
    if (hint?.reason !== 'rejected-candidate') {
      return `CREATE  ${summary}`;
    }
    const others =
      hint.candidateCount > 1 ? ` (+${hint.candidateCount - 1} more)` : '';
    return `CREATE? ${summary}${CONTINUATION_INDENT}check: a candidate was not matched: ${describeCounterpart(hint.counterpart)}${others}`;
  }

  const approves = item.match.approvesPendingTransaction
    ? ' (approves pending)'
    : '';
  const before = item.match.before;
  const beforeDate = formatDate(before.date);
  const changes = [
    before.description === item.description
      ? null
      : `description "${before.description}" -> "${item.description}"`,
    before.value === item.value
      ? null
      : `value ${before.value.toFixed(2)} -> ${item.value.toFixed(2)}`,
    beforeDate === date ? null : `date ${beforeDate} -> ${date}`,
  ].filter((change) => change !== null);

  const diff =
    changes.length > 0 ? `${CONTINUATION_INDENT}${changes.join('; ')}` : '';
  if (hint?.reason !== 'unrelated-merge') {
    return `MERGE   ${summary}${approves}${diff}`;
  }
  return `MERGE?  ${summary}${approves}${CONTINUATION_INDENT}check: merges onto a transaction sharing no word with this row: ${describeCounterpart(hint.counterpart)}${diff}`;
}

/** The line printed before the confirmation, or null when nothing is flagged. */
export function reviewReminder(
  items: ReconciliationPreviewItem[],
): string | null {
  const flagged = items.filter((item) => item.reviewHint !== null).length;
  if (flagged === 0) {
    return null;
  }
  return `${flagged} row(s) marked CREATE? or MERGE? above are close calls; review them before confirming.`;
}

function describeCounterpart(counterpart: ReconciliationCounterpart): string {
  const status =
    counterpart.status === 'PENDING_APPROVAL' ? 'pending' : 'approved';
  return `"${counterpart.description}" ${counterpart.value.toFixed(2)} on ${formatDate(counterpart.date)} (${status})`;
}

/** Dates arrive as JSON strings even though the plan type names them Date. */
function formatDate(value: Date | string): string {
  return toDayString(new Date(value));
}
