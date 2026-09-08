-- Vertragsdaten am Unternehmen fuer den Direktvertrag (Titelseite):
-- Reg.-Code/Handelsregister, USt-IdNr. und Vertretungszeile (z.B. Geschaeftsfuehrer).

alter table public.unternehmen
  add column if not exists reg_code text,
  add column if not exists ust_id text,
  add column if not exists vertreten_durch text;

comment on column public.unternehmen.reg_code is 'Handelsregister / Reg.-Code des Unternehmens (Vertragstitelseite)';
comment on column public.unternehmen.ust_id is 'USt-IdNr. des Unternehmens (Vertragstitelseite)';
comment on column public.unternehmen.vertreten_durch is 'Vertretungszeile, z.B. "Geschaeftsfuehrer Max Mustermann, handelnd auf Grundlage des Gesellschaftsvertrags"';
