# Import lifecycle

Load before changing an import's statuses, the upload route, the extraction webhook
(`/api/excel-extraction-agent/webhook`), re-matching, the `/api/imports/fail-stuck` cron or
import deletion.

The extraction itself runs in the external `excel-extraction-service`, which calls back
asynchronously. The callback carries an HMAC in query params over `userId:timestamp:importId`, so
it is bound to the import it was submitted for. Collecting statements from the card portals is the
`.claude/skills/collect-statements/` skill.

## A duplicate import is kept as a pointer

When the extraction webhook finds a COMPLETED import for the same card and month — the oldest,
whichever upload came first, since the one being processed is not yet COMPLETED and two callbacks
therefore never merge into each other — one transaction moves the non-duplicate rows there, puts
the survivor in `REMATCHING`, and marks the duplicate `MERGED` with `mergedIntoImportId`.

- The survivor returns to `COMPLETED` only after `findPotentialMatchesForImport` has run over it.
  So `COMPLETED` means "no matching is running", the web UI and `scripts/import-statements.ts`
  both wait on that status rather than racing it, and the script follows the recorded pointer
  (`GET /api/imports/[id]`) instead of reconstructing the survivor from the filename.
- A `MERGED` import holds no rows and never becomes a merge target (`findExisting` requires
  `COMPLETED`).
- Card digits are encrypted, so `importRepository.findExisting` matches them in memory →
  [database.md](database.md), before adding an encrypted column.

## Leaving `REMATCHING`

- Every exit from `REMATCHING`, success or failure, is back to `COMPLETED`, written only while the
  status is still `REMATCHING` (`importRepository.transitionStatus`), and a release that fails is
  tried once more and reported; only a function killed mid-run, or a release that fails twice,
  leaves an import there.
- A re-match (`rematchImport`) enters it the same way from `COMPLETED`, so of two concurrent calls
  one gets 409, and reads its rows only after; a failed one leaves the rows it had not reached
  unmatched for a retry.
- A webhook that fails after its merge committed releases the survivor its `MERGED` import points
  to.

## Payment month

The submitted payment month wins over the one extraction reports, since card + month is the
duplicate key. That key is compared as stored, so every write stores the month as `MM/YYYY`
through `normalizePaymentMonth` (`src/shared/paymentMonth.ts`): an upload with any other month is
a 400 (the upload form checks first, before any bytes move), and the webhook reads both the
submitted and the extracted month through it, ignoring one that names no month.

## Failure, stuck imports and deletion

- A FAILED import keeps its extraction claim, since a redelivery after a partial write would
  insert every row again, so recovery is delete and re-import.
- An extraction callback's token lives `WEBHOOK_TOKEN_EXPIRY_MS`
  (`src/server/utils/webhookAuth.ts`), so an import still `PROCESSING` that long after it was
  created can never complete; the `/api/imports/fail-stuck` cron fails it, claiming the extraction
  as it does, and the user deletes and re-imports. It skips an import a callback claimed within
  `CALLBACK_CLAIM_GRACE_MS` (`src/server/repositories/crossHouseholdRepository.ts`), longer than
  any function runs, so a callback mid-write finishes.
- Deleting an import deletes its rows with it, so none can still be approved or hold a match a
  re-import needs.

How each extracted row's amount becomes ILS → [money-and-currency.md](money-and-currency.md),
before changing `importedAmountService`.
