-- Every amount recorded before this migration was entered, imported and shown
-- as ILS, so existing rows are backfilled as ILS explicitly: currency 'ILS',
-- originalAmount = value, and no conversion. value itself is not touched, so
-- every total reads the same before and after.
CREATE TYPE "ExchangeRateSource" AS ENUM ('STATEMENT', 'BANK_OF_ISRAEL', 'MANUAL');

ALTER TABLE "Transaction"
  ADD COLUMN "currency" CHAR(3) NOT NULL DEFAULT 'ILS',
  ADD COLUMN "originalAmount" DECIMAL(14,2),
  ADD COLUMN "exchangeRate" DECIMAL(18,8),
  ADD COLUMN "exchangeRateDate" DATE,
  ADD COLUMN "exchangeRateSource" "ExchangeRateSource";

UPDATE "Transaction" SET "originalAmount" = ROUND("value"::numeric, 2);

ALTER TABLE "Transaction" ALTER COLUMN "originalAmount" SET NOT NULL;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_conversion_check" CHECK (
  ("currency" = 'ILS'
    AND "exchangeRate" IS NULL
    AND "exchangeRateDate" IS NULL
    AND "exchangeRateSource" IS NULL)
  OR ("currency" <> 'ILS'
    AND "exchangeRate" IS NOT NULL
    AND "exchangeRateDate" IS NOT NULL
    AND "exchangeRateSource" IS NOT NULL)
);

ALTER TABLE "ImportedTransaction"
  ADD COLUMN "currency" CHAR(3),
  ADD COLUMN "originalAmount" DECIMAL(14,2),
  ADD COLUMN "exchangeRate" DECIMAL(18,8),
  ADD COLUMN "exchangeRateDate" DATE,
  ADD COLUMN "exchangeRateSource" "ExchangeRateSource";

UPDATE "ImportedTransaction"
  SET "currency" = 'ILS', "originalAmount" = ROUND("value"::numeric, 2);

ALTER TABLE "ImportedTransaction" ALTER COLUMN "originalAmount" SET NOT NULL;

ALTER TABLE "ImportedTransaction" ALTER COLUMN "value" DROP NOT NULL;
