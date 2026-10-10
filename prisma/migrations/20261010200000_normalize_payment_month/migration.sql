-- Writes now store the payment month as MM/YYYY. Rows written before that may
-- hold '3/2026' or padding spaces, which would never key the same duplicate as
-- '03/2026'. A value that names no month is left as it is.
UPDATE "Import"
SET "paymentMonth" =
  lpad(split_part(btrim("paymentMonth"), '/', 1), 2, '0') || '/' ||
  split_part(btrim("paymentMonth"), '/', 2)
WHERE btrim("paymentMonth") ~ '^(0?[1-9]|1[0-2])/[0-9]{4}$'
  AND "paymentMonth" !~ '^(0[1-9]|1[0-2])/[0-9]{4}$';
