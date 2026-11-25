-- Medienablage: Unterordner im Rohmaterial (ADR 0070).
-- Dateien in freien Ordnern unter <Kooperation>/Rohmaterial/ sind jetzt Rohmaterial der
-- Kooperation. Bisher hat der Abgleich sie mit grund = 'freier_ordner' ignoriert. Diese
-- Migration stellt sie einmalig wieder auf 'offen', damit der nächste Lauf sie einordnet.
-- Kein Schema-Wechsel: die Ordner stehen schon als art = 'frei', typ = 'rohmaterial' im Register.
--
-- ROLLBACK: nicht nötig (Daten-Nachlauf). Nach einem Rollback der Functions ignoriert der
-- Abgleich neue Dateien dort wieder; schon angelegte Rohmaterial-Zeilen bleiben.

BEGIN;

UPDATE public.ablage_eingang e
   SET status = 'offen',
       grund = NULL,
       versuche = 0,
       naechster_versuch = now(),
       gesperrt_bis = NULL
  FROM public.ablage_ordner o
 WHERE o.drive_id = e.drive_id
   AND o.item_id = e.parent_item_id
   AND o.art = 'frei'
   AND o.typ = 'rohmaterial'
   AND o.geloescht_at IS NULL
   AND e.status = 'ignoriert'
   AND e.grund = 'freier_ordner'
   AND NOT e.ist_ordner
   AND NOT e.geloescht;

COMMIT;
