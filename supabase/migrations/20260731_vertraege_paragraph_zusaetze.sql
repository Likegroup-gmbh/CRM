-- Zusätzliche Bestimmungen pro Paragraph (Freitext, optional)
-- Struktur: { "p1": "Text...", "p4": "Text..." } – Key = §-Nummer des jeweiligen Vertragstyps
alter table vertraege add column if not exists paragraph_zusaetze jsonb;

comment on column vertraege.paragraph_zusaetze is 'Optionale Zusatz-Bestimmungen pro Paragraph, Key = §-Nummer (z.B. p1..p6 bei UGC)';
