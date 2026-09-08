-- Trial-Reel-Erkennung im Connect-Flow (instagram-connect):
-- ig_recent_posts bleibt die rohe Liste der 5 neuesten Posts, daneben gibt es
-- jetzt die gefilterte Ansicht (ohne per View-Luecke erkannte Trial-Reels),
-- das Gate-Ergebnis und eine bereinigte Engagement-Rate. Alle drei Felder sind
-- nur befuellt, wenn das Gate aktiv war - sonst bleiben sie NULL und die UI
-- zeigt unveraendert die rohe Liste.

BEGIN;

ALTER TABLE public.creator
  ADD COLUMN IF NOT EXISTS ig_recent_posts_clean jsonb,
  ADD COLUMN IF NOT EXISTS ig_trial_gate jsonb,
  ADD COLUMN IF NOT EXISTS ig_engagement_rate_clean numeric;

COMMENT ON COLUMN public.creator.ig_recent_posts_clean IS
  '5 neueste Posts ohne per View-Luecke erkannte Trial-Reels (nur wenn ig_trial_gate.aktiv)';
COMMENT ON COLUMN public.creator.ig_trial_gate IS
  'Ergebnis der Trial-Luecken-Erkennung: {aktiv, grund, reg_median, gap_ratio, schwelle, cluster_size}';
COMMENT ON COLUMN public.creator.ig_engagement_rate_clean IS
  'Engagement-Rate ohne Trial-Reels (nur wenn ig_trial_gate.aktiv)';

COMMIT;
