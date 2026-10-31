# Money and currency

Load before touching an amount, a currency, an exchange rate, a sum or total, or an amount schema.

## `value` is always ILS; the original currency rides beside it

- Every report, chart, chat figure and summary sums `Transaction.value`, which is the amount in
  the reporting currency (`BASE_CURRENCY` in `src/shared/currency.ts`), so no total ever adds two
  currencies.
- Each row also stores `currency` (ISO 4217) and `originalAmount` (`NUMERIC(14,2)`); a non-ILS row
  carries `exchangeRate` (`NUMERIC(18,8)`), `exchangeRateDate` and `exchangeRateSource`, and a
  CHECK constraint holds those three set exactly when the currency is foreign.
- Conversion arithmetic goes through `src/server/utils/money.ts` (decimal.js, rounded once, half
  away from zero); decimals are written as strings via
  `src/server/repositories/amountColumns.ts`.
- Rows predating the feature were backfilled as ILS by migration
  `20261008000000_transaction_currency`. Scheduled transactions are ILS-only.

## Resolving a create or edit

`currencyConversionService.resolveAmount` decides a create or edit: a rate the caller gives, else
an ILS amount the caller gives (`MANUAL`), else the Bank of Israel representative rate for the
transaction date (`src/server/services/exchangeRateService.ts`, 5s timeout, cached in Redis for a day —
an hour when today's rate is not out yet and an earlier day's stands in), else a 422 — never 1:1.

- An edit that leaves currency, original amount and day alone keeps its conversion.
- A payload with only `value` is ILS, as before currencies.

## Amount bounds

Every amount a request carries is between `MINIMUM_AMOUNT` (a cent, the smallest the column
stores) and `MAXIMUM_AMOUNT`; the transaction type carries the direction. REST schemas build on
`src/shared/schemas/amount.ts`, which refuses a blank or non-numeric field rather than coercing
it, and the MCP tools take the same bounds.

## An imported row's billed ILS is its conversion

- The extraction service reports each row's `originalAmount`/`originalCurrency` and
  `chargedAmount`/`chargedCurrency` (additive to `value`), and
  `importedAmountService.resolveExtractedAmounts` stores a billed ILS amount as the conversion
  (`STATEMENT`) without converting it again; only an unbilled foreign amount is converted, one
  rate lookup per currency and day.
- An amount with no currency named is the statement's own (ILS), as an instalment's full price
  beside its payment is.
- With no rate, or a row the service marks `currencyAmbiguous` (as is one whose currency code is
  not ISO 4217 — never read as ILS), `ImportedTransaction.value` is null (and `currency` null when
  unknown); the UI flags it and approve and batch fail that row with a 422 until an ILS amount is
  entered.
- A merge into a transaction holding the same currency and original amount takes that
  transaction's conversion instead.
- Matching and duplicate detection compare currency and original amount as well as `value` →
  [import-matching.md](import-matching.md), before changing how rows are matched.
