# Import matching and reconciliation

Load before changing how an imported row is matched, previewed, approved, merged or flagged as a
duplicate: `src/server/utils/transactionMatching.ts`, `importService`, the reconciliation preview
or `scripts/import-statements.ts`.

## Matching a row to an existing transaction

- An imported row is paired with an existing transaction by
  `transactionRepository.findPotentialMatches` — ±5 days, and a _relative_ value tolerance of
  `max(2, 1%)` (`matchValueTolerance`) — a card dates a row by settlement, not purchase, and a
  flat tolerance does not scale.
- Among the candidates a single normalized-equal description wins outright
  (`findExactNormalizedMatch`, `src/server/utils/transactionMatching.ts`) and never reaches the
  model; a tie or no exact hit does. That short-circuit keeps a multi-month backfill affordable.
- A recurring charge whose amount drifts is declared on its schedule as a
  `bankDescriptionPrefix`. Each pending transaction the cron projects links back to its schedule
  (`scheduledTransactionId`), so the prefix is read through that link and an edit reaches rows
  already projected. While such a transaction is pending it is a candidate at any value — date
  window and direction still apply — but only for a row whose normalized description starts with
  the prefix. The model judges the row's other candidates first and never sees a placeholder,
  whose projected value means nothing; the placeholder takes the row only when none of them does
  (the longest prefix, then the nearest date), so a charge already logged by hand is not doubled.
  Such a merge is not flagged `unrelated-merge`.
- `matchCandidateFilter` (`src/server/utils/transactionMatching.ts`) is the one predicate the
  matcher and the preview hints share.
- Matching and duplicate detection compare currency and original amount as well as `value`, so a
  foreign charge matches a hand-logged entry converted at another rate →
  [money-and-currency.md](money-and-currency.md), before changing how an imported amount is
  converted.

## One function decides merge-vs-create

- `importService.toReconciliationPlanItem` derives every server path's MERGE/CREATE (preview,
  `batchApproveImportedTransactions`, `applyAutoApproveRules`); `ImportedTransactionList` keeps its
  own client view.
- Commits take row ids, not a plan, so `scripts/import-statements.ts` approves the rows it
  previewed.
- Applying goes through `applyCreate`/`applyMerge` on the row `loadPendingSelection` loaded —
  never a loop over the public `approveImportedTransaction`/`mergeImportedTransaction` — and they
  return what to notify so the batch calls `notifyTransactionsCreatedSafe` once.
- A merge acts on the match as loaded, so a concurrent rematch is not seen.
- Approve, merge and ignore act only on a PENDING, non-deleted row (409 otherwise, 404 once
  deleted), and the write itself is scoped to PENDING, so of two concurrent submits one wins and
  the other gets 409 — in a batch, only that row fails.

## A preview flags close calls without deciding them

`GET /api/imports/[importId]/reconciliation-preview` reports what approving the import would do,
writing nothing. Each preview item carries a `reviewHint` derived after `toReconciliationPlanItem`
has fixed the action, from database lookups only and never a model call:

- `unmatched-candidate` when a CREATE row still has an unclaimed transaction inside its match
  window (fetched for every CREATE row in one query). The window is `matchWindow`
  (`src/server/utils/transactionMatching.ts`), the same bounds `findPotentialMatches` queries by.
- `unrelated-merge` when a MERGE's two descriptions share no normalized word.

Neither hint changes what the commit does; `scripts/import-statements.ts` prints flagged rows as
`CREATE?`/`MERGE?` with the other side's description.

Each row also carries a `cardHoldingFee` flag marking the issuer's monthly charge for holding the
card — recognized from the description alone by `src/shared/cardFees.ts`, with no model call and
no extra query. It is its own field rather than a hint reason because it never bears on the
MERGE/CREATE decision.

## Duplicate rows are matched up to a shortened merchant name

`isSameCharge` (`src/server/utils/transactionMatching.ts`) requires equal date, value, currency,
original amount and type, and the shorter normalized description to be whole words from either
end of the longer one (the extractor drops a trailing branch, mall or city, and sometimes a
leading "refund"), or a leading prefix past half the longer one when the cut lands mid-word. A side
under three characters never matches. `selectNonDuplicateRows` claims each existing row at most
once, so a genuinely repeated charge still imports.

Duplicate _imports_ (the same card and month uploaded twice) →
[import-lifecycle.md](import-lifecycle.md), before changing import statuses or the extraction
webhook.
