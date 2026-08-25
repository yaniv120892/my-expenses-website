-- ScheduledTransaction had no indexes at all: the 07:00 cron scans
-- nextRunDate across every user (so it cannot use a userId-prefixed index),
-- and the page lists one user's schedules sorted by nextRunDate.
CREATE INDEX "ScheduledTransaction_nextRunDate_idx" ON "ScheduledTransaction"("nextRunDate");

-- CreateIndex
CREATE INDEX "ScheduledTransaction_userId_nextRunDate_idx" ON "ScheduledTransaction"("userId", "nextRunDate");

-- The imports list filters (userId, deleted) and sorts createdAt desc; the
-- composite serves that whole shape and supersedes the plain userId index
-- (equality columns first, sort column last).
CREATE INDEX "Import_userId_deleted_createdAt_idx" ON "Import"("userId", "deleted", "createdAt");

-- DropIndex
DROP INDEX "Import_userId_idx";
