-- Lieferanten als Firmen mit Kennzeichen, Buchungen damit verknuepft.
-- Rueckwaertskompatibel: nur neue Spalten mit Standardwert, nichts umbenannt.
-- transactions.customer_id bleibt "an Kunde weiterverrechnen"; der Lieferant
-- einer Ausgabe steht neu in supplier_id (counterparty bleibt als Text).

alter table public.customers
  add column if not exists is_supplier boolean not null default false;

alter table public.transactions
  add column if not exists supplier_id uuid references public.customers(id) on delete set null;

create index if not exists idx_transactions_supplier_id on public.transactions(supplier_id);
