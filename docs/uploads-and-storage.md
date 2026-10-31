# Uploads and storage

Load before changing a file upload, an attachment, an S3 key or bucket path, or a path that deletes
transactions or files.

## One upload size cap

`src/shared/uploadLimits.ts` is the one file-size cap (under a function's ~4.5 MB request body)
that every upload path checks, client before any bytes move and server with a 413. An
attachment's declared size is signed into its presigned upload URL, so the store holds the bytes
to it.

## An attachment's S3 object goes with its row

- Removing an attachment marks its `TransactionFile` `MARKED_FOR_DELETION`, then `DELETED` once
  the object is gone; deleting a transaction returns the keys its cascade dropped, read by the
  delete itself.
- `transactionService` deletes each object only after the database write, keeps one another
  `ACTIVE` row still names, and bounds the call at 5s.
- Storage is best effort: a failure logs a warning carrying the key, so the orphan can be found and
  removed, is reported via `observability.reportError` with no key or file name (a storage error
  can quote one), never fails the request, and leaves a removed row `MARKED_FOR_DELETION`.
- Only `transactionService` knows the keys, so a path that deletes transactions or files goes
  through it, and a database-level delete it does not drive orphans their objects.

## An S3 key never holds the user's file name

Import and attachment keys are a random id plus the lowercased extension
(`src/server/utils/storageObjectName.ts`), since a key is logged and travels in URLs; the name
lives in `Import.originalFileName` and `TransactionFile.fileName`, and the extraction service gets
it as `filename`. Attachments uploaded before keep their name-bearing keys, which validation,
preview, download and delete still accept; import objects are never deleted, and an old import
URL still passes the bucket-prefix check.
