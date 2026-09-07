-- Merge: STADA-Auftragsduplikat zusammenfuehren
-- Survivor:  fff117d9-af9d-4636-9296-5f75d630a7fb (Folgeprojekt_1_STADA)
-- Geloescht: 07550a64-6ccb-471d-bb3b-215a94972253 (UGC / Influencer – April 2026)
-- Beide traegen RE-2026-0036 und identische Betraege (20.000 netto / 23.800 brutto)
-- => gleicher Auftrag, doppelt angelegt. Beträge werden NICHT addiert.
-- Backup: backups/2026-09-04-auftrag-merge-stada.json

BEGIN;

-- 1) Survivor anreichern: nur Felder, die am Survivor leer sind
UPDATE auftrag
SET
  status      = 'Beauftragt',
  externe_po  = '4900173312'
WHERE id = 'fff117d9-af9d-4636-9296-5f75d630a7fb';

-- 2) Auftragsdetails des Survivors mit den gepflegten Feldern des Duplikats fuellen
--    (Zahlen wie gesamt_creator bleiben unveraendert — nichts wird addiert)
UPDATE auftrag_details
SET
  campaign_type           = ARRAY['ugc_paid'],
  agency_services_enabled = true,
  ksk_enabled             = true,
  ksk_type                = 'percentage',
  ksk_value               = 4.90,
  ugc_paid_budget_info    = 'Nur gute Creator einbuchen. Dafür höheres UGC-Budget.'
WHERE id = '98999636-1196-4b56-9237-4149046d217a'
  AND auftrag_id = 'fff117d9-af9d-4636-9296-5f75d630a7fb';

-- 3) Verknuepfte Datensaetze des Duplikats umhaengen
UPDATE kampagne
SET auftrag_id = 'fff117d9-af9d-4636-9296-5f75d630a7fb'
WHERE id = 'cdfaee19-a623-4188-8dc3-ce7958a24b0c'
  AND auftrag_id = '07550a64-6ccb-471d-bb3b-215a94972253';

UPDATE rechnung
SET auftrag_id = 'fff117d9-af9d-4636-9296-5f75d630a7fb'
WHERE id IN ('cce4444b-da23-484d-8695-c3ffdeef8932', 'f3469cf6-75e7-45a6-8537-1e9e520a6b1f')
  AND auftrag_id = '07550a64-6ccb-471d-bb3b-215a94972253';

-- 4) Duplikat-Details und Duplikat-Auftrag loeschen
DELETE FROM auftrag_details
WHERE id = '03dbf161-9cb1-4c88-8a10-bb3e3d2b1734'
  AND auftrag_id = '07550a64-6ccb-471d-bb3b-215a94972253';

DELETE FROM auftrag
WHERE id = '07550a64-6ccb-471d-bb3b-215a94972253';

COMMIT;
