-- EHG-Vertrag (UGC-Template): Projektblatt-Felder, nur bei typ = UGC und Kunde EHG befuellt
alter table vertraege add column if not exists ehg_felder jsonb;

comment on column vertraege.ehg_felder is 'Projektblatt-Felder des EHG-Vertrags (Nutzungen, Gebiet, Dauer, USt, Unterlagen), nur bei typ = UGC befuellt';
