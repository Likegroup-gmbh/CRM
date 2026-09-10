-- is_current-Drift: Flag aus hoechster Loop-Version ableiten.
-- Videos/Stills/Storys: Loop-Assets der max. version_number = current, Rest + Finals = false.

BEGIN;

UPDATE public.kooperation_video_asset v
SET is_current = false
WHERE is_final = false
  AND is_current = true
  AND version_number IS DISTINCT FROM (
    SELECT MAX(v2.version_number)
    FROM public.kooperation_video_asset v2
    WHERE v2.video_id = v.video_id
      AND v2.is_final = false
  );

UPDATE public.kooperation_video_asset v
SET is_current = true
WHERE is_final = false
  AND is_current = false
  AND version_number = (
    SELECT MAX(v2.version_number)
    FROM public.kooperation_video_asset v2
    WHERE v2.video_id = v.video_id
      AND v2.is_final = false
  );

UPDATE public.kooperation_video_asset
SET is_current = false
WHERE is_final = true
  AND is_current = true;

UPDATE public.kooperation_bilder_asset b
SET is_current = false
WHERE is_final = false
  AND is_current = true
  AND version_number IS DISTINCT FROM (
    SELECT MAX(b2.version_number)
    FROM public.kooperation_bilder_asset b2
    WHERE b2.video_id IS NOT DISTINCT FROM b.video_id
      AND b2.is_final = false
  );

UPDATE public.kooperation_bilder_asset b
SET is_current = true
WHERE is_final = false
  AND is_current = false
  AND version_number = (
    SELECT MAX(b2.version_number)
    FROM public.kooperation_bilder_asset b2
    WHERE b2.video_id IS NOT DISTINCT FROM b.video_id
      AND b2.is_final = false
  );

UPDATE public.kooperation_bilder_asset
SET is_current = false
WHERE is_final = true
  AND is_current = true;

UPDATE public.kooperation_story_asset s
SET is_current = false
WHERE is_final = false
  AND is_current = true
  AND version_number IS DISTINCT FROM (
    SELECT MAX(s2.version_number)
    FROM public.kooperation_story_asset s2
    WHERE s2.story_id = s.story_id
      AND s2.is_final = false
  );

UPDATE public.kooperation_story_asset s
SET is_current = true
WHERE is_final = false
  AND is_current = false
  AND version_number = (
    SELECT MAX(s2.version_number)
    FROM public.kooperation_story_asset s2
    WHERE s2.story_id = s.story_id
      AND s2.is_final = false
  );

UPDATE public.kooperation_story_asset
SET is_current = false
WHERE is_final = true
  AND is_current = true;

COMMIT;
