-- Awareness-Template (BURGA): zusaetzliche Vertragsfelder die nur dieses PDF-Layout braucht
-- Struktur: { "vertrag_datum": "2026-01-15", "brand_tag": "@burgaofficial", ... }
alter table vertraege add column if not exists awareness_felder jsonb;

comment on column vertraege.awareness_felder is 'Felder des Awareness-PDF-Templates (Vertragsdatum, Brand-Tag, Fristen, Steuer-IDs), nur bei typ = Influencer Kooperation befuellt';
