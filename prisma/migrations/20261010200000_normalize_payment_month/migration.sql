-- Writes now store the payment month as MM/YYYY. Rows written before that may
-- hold '3/2026' or surrounding whitespace, which would never key the same
-- duplicate as '03/2026'. A value that names no month is left as it is.
UPDATE "Import"
SET "paymentMonth" =
  lpad(split_part(btrim("paymentMonth", E' \t\r\n'), '/', 1), 2, '0') || '/' ||
  split_part(btrim("paymentMonth", E' \t\r\n'), '/', 2)
WHERE btrim("paymentMonth", E' \t\r\n') ~ '^(0?[1-9]|1[0-2])/[0-9]{4}$'
  AND "paymentMonth" !~ '^(0[1-9]|1[0-2])/[0-9]{4}$';
