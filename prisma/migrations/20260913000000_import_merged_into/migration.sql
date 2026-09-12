-- A duplicate import is kept and marked rather than deleted, pointing at the
-- import its rows went into, so a caller can follow the merge instead of
-- reconstructing it from the filename.
ALTER TYPE "ImportStatus" ADD VALUE 'MERGED';

ALTER TABLE "Import" ADD COLUMN "mergedIntoImportId" UUID;

ALTER TABLE "Import" ADD CONSTRAINT "Import_mergedIntoImportId_fkey"
  FOREIGN KEY ("mergedIntoImportId") REFERENCES "Import"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Import_mergedIntoImportId_idx" ON "Import"("mergedIntoImportId");
