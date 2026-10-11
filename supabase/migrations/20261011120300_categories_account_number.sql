-- Migration: Kontonummer nach Schweizer Kontenrahmen KMU pro Kategorie (Punkt 3B)
--
-- Vorbereitung fuer eine spaetere GmbH bzw. die Uebernahme in eine
-- Finanzbuchhaltung (bexio, Banana). Keine doppelte Buchhaltung: Die
-- Kategorie bleibt der Schluessel der Buchung, die Kontonummer ist nur ein
-- Attribut der Kategorie und in den Einstellungen bearbeitbar.
--
-- Zuordnung freigegeben am 11.10.2026. Gesichert aus der Schulversion des
-- Kontenrahmens (kmu.admin.ch): 3200, 3400, 3600, 4200, 5000, 6000, 6200,
-- 6300, 6500, 6570, 6600, 6700, 6800, 6950. Nur sekundaer belegt (Inspecta,
-- bexio): 6640 Reisespesen, 6940 Bankspesen.
--
-- Rueckwaertskompatibel: neue, nullbare Spalte; bestehende Spalten und
-- Buchungen bleiben unveraendert. Gesetzt wird nur, wo noch nichts steht.

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS account_number text NULL;

COMMENT ON COLUMN public.categories.account_number IS
  'Konto nach Schweizer Kontenrahmen KMU (z.B. 6570), frei aenderbar';

UPDATE public.categories c
   SET account_number = m.account_number
  FROM (VALUES
    ('Dienstleistungsumsatz', 'income',  '3400'),
    ('Warenverkauf',          'income',  '3200'),
    ('Nebenerlöse',           'income',  '3600'),
    ('Zinserträge',           'income',  '6950'),
    ('Warenaufwand',          'expense', '4200'),
    ('Personalaufwand',       'expense', '5000'),
    ('Raumaufwand',           'expense', '6000'),
    ('Informatik & Telekom',  'expense', '6570'),
    ('Werbung & Marketing',   'expense', '6600'),
    ('Fahrzeugkosten',        'expense', '6200'),
    ('Versicherungen',        'expense', '6300'),
    ('Büromaterial',          'expense', '6500'),
    ('Reisekosten',           'expense', '6640'),
    ('Abschreibungen',        'expense', '6800'),
    ('Bankspesen',            'expense', '6940'),
    ('Sonstige Ausgaben',     'expense', '6700')
  ) AS m(name, type, account_number)
 WHERE c.name = m.name
   AND c.type::text = m.type
   AND c.account_number IS NULL;
