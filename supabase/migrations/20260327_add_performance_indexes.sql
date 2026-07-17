-- Performance-Indizes für Kampagnen-bezogene Queries
-- Beschleunigt .eq('kampagne_id', ...) und .in('kampagne_id', [...]) Aufrufe

CREATE INDEX IF NOT EXISTS idx_kooperationen_kampagne_id
  ON kooperationen(kampagne_id);

CREATE INDEX IF NOT EXISTS idx_kampagne_mitarbeiter_kampagne_id
  ON kampagne_mitarbeiter(kampagne_id);

-- Composite-Index für die konsolidierte Rollen-Query (.in('role', [...]))
CREATE INDEX IF NOT EXISTS idx_kampagne_mitarbeiter_kampagne_role
  ON kampagne_mitarbeiter(kampagne_id, role);

CREATE INDEX IF NOT EXISTS idx_kooperation_videos_kooperation_id
  ON kooperation_videos(kooperation_id);

CREATE INDEX IF NOT EXISTS idx_ansprechpartner_kampagne_kampagne_id
  ON ansprechpartner_kampagne(kampagne_id);

-- Versand-Tabelle: wird jetzt in Stufe 2 parallel geladen
CREATE INDEX IF NOT EXISTS idx_kooperation_versand_kooperation_id
  ON kooperation_versand(kooperation_id);

-- Video-Assets und Comments: häufig per video_id abgefragt
CREATE INDEX IF NOT EXISTS idx_kooperation_video_asset_video_id
  ON kooperation_video_asset(video_id)
  WHERE is_current = true;

CREATE INDEX IF NOT EXISTS idx_kooperation_video_comment_video_id
  ON kooperation_video_comment(video_id)
  WHERE deleted_at IS NULL;
