-- AVIF fuer Produktbilder erlauben.
--
-- Produktbilder werden ab jetzt als AVIF abgelegt: bei gleicher Optik rund
-- 30-50% kleiner als WebP. Encodieren kann das im Browser aber nur Chromium -
-- Firefox und Safari fallen auf WebP zurueck. WebP, JPEG und PNG bleiben
-- deshalb erlaubt, sonst wuerden Uploads aus diesen Browsern abgewiesen und
-- bereits gespeicherte Dateien liessen sich nicht mehr ersetzen.

BEGIN;

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/avif', 'image/webp', 'image/jpeg', 'image/png']
WHERE id = 'produkte';

COMMIT;
