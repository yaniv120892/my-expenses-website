-- Claimed by the first extraction callback so a redelivered webhook is a no-op.
ALTER TABLE "Import" ADD COLUMN "extractionCompletedAt" TIMESTAMP(3);

-- Imports that already finished must not be re-processed by a late redelivery.
UPDATE "Import"
SET "extractionCompletedAt" = COALESCE("completedAt", "updatedAt")
WHERE "status" IN ('COMPLETED', 'FAILED');

-- Keep the oldest import per request id and detach the rest, so the unique
-- index below can be created on existing data.
UPDATE "Import"
SET "excelExtractionRequestId" = NULL
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (
      PARTITION BY "excelExtractionRequestId" ORDER BY "createdAt"
    ) AS "rowNumber"
    FROM "Import"
    WHERE "excelExtractionRequestId" IS NOT NULL
  ) AS "ranked"
  WHERE "rowNumber" > 1
);

-- One import per extraction request, so the callback resolves deterministically.
DROP INDEX IF EXISTS "Import_excelExtractionRequestId_idx";

CREATE UNIQUE INDEX "Import_excelExtractionRequestId_key" ON "Import"("excelExtractionRequestId");
