-- Matching-Score am Casting-Eintrag: Gesamtwert aus Fit/Track/Fresh,
-- der beim Aktivieren eines KI-Vorschlags mitgeschrieben wird.

BEGIN;

ALTER TABLE public.creator_auswahl_items
  ADD COLUMN IF NOT EXISTS matching_score integer,
  ADD COLUMN IF NOT EXISTS matching_scores jsonb;

COMMENT ON COLUMN public.creator_auswahl_items.matching_score IS
  'Gesamtscore 0-100 aus Fit/Track/Fresh beim Aktivieren eines KI-Vorschlags.';
COMMENT ON COLUMN public.creator_auswahl_items.matching_scores IS
  'Rohwerte { fit, track, fresh } zum Matching-Balken.';

UPDATE public.creator_auswahl_items i
SET
  matching_score = ROUND(
    0.6 * COALESCE((v.scores->>'fit')::numeric, 0)
    + 0.25 * COALESCE((v.scores->>'track')::numeric, 0)
    + 0.15 * COALESCE((v.scores->>'fresh')::numeric, 0)
  ),
  matching_scores = v.scores
FROM public.casting_vorschlag v
WHERE v.creator_id = i.creator_id
  AND v.casting_id = i.creator_auswahl_id
  AND v.status = 'accepted'
  AND v.scores IS NOT NULL
  AND i.matching_score IS NULL;

COMMIT;
