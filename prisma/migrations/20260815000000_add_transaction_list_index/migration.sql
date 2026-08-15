-- The transactions list filters on userId + status + date and sorts by date,
-- which previously scanned the user's whole history on every page.
CREATE INDEX "Transaction_userId_status_date_idx" ON "Transaction"("userId", "status", "date");
