-- AVIF fuer Instagram-Bilder erlauben.
--
-- storeImagePair (netlify/functions/_shared/instagram-graph.js) legt Profilbilder
-- seit dem Umbau auf zwei Groessen als AVIF ab, der Bucket war aber noch auf
-- WebP/JPEG/PNG beschraenkt. Supabase hat jeden Upload mit "mime type image/avif
-- is not supported" abgewiesen; storeImagePair faengt das ab und liefert null,
-- deshalb blieben profile_image_url und profile_image_thumb_url still leer.
--
-- produkte kommt mit rein: 20260728_produkte_bucket_avif.sql liegt zwar im Repo,
-- ist auf der Datenbank aber nie angekommen. WebP, JPEG und PNG bleiben erlaubt,
-- damit Altbestand ersetzbar bleibt und Browser ohne AVIF-Encoder weiter hochladen
-- koennen.

BEGIN;

UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/avif', 'image/webp', 'image/jpeg', 'image/png']
WHERE id IN ('instagram-media', 'produkte');

-- Merker fuer den selbstheilenden Nachzug in sourcing-instagram-stats.js:
-- fehlt im Pool ein Bild, wird einmal bei Meta nachgefragt. Liefert Meta keins
-- (oder scheitert der Upload), verhindert dieser Zeitstempel, dass jeder weitere
-- Klick erneut Quota verbrennt. Ein ausdruecklicher Refresh (force) ignoriert ihn.
ALTER TABLE public.sourcing_creator
  ADD COLUMN IF NOT EXISTS ig_image_failed_at timestamptz;

COMMENT ON COLUMN public.sourcing_creator.ig_image_failed_at IS
  'Zeitpunkt des letzten erfolglosen Profilbild-Abrufs. Gesetzt, wenn Meta kein Bild lieferte oder der Storage-Upload scheiterte; wird bei Erfolg wieder auf null gesetzt.';

COMMIT;
