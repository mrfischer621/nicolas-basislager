-- Ensure invoice_items.description column is TEXT type (for HTML rich-text storage)
-- This is a safety migration – Postgres TEXT already supports HTML strings.
-- If the column was previously VARCHAR(n), this removes the length limit.

ALTER TABLE public.invoice_items
  ALTER COLUMN description TYPE text;
