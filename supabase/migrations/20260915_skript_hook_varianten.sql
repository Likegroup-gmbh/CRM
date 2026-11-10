-- Hook-Varianten (Hook 1-3) als zusaetzliche gesprochene Hooks unter dem Haupthook
--   skripte + skript_versionen bekommen je drei Varianten-Felder
--   Quelle: Meeting 03.09.2026 - Hook hat den groessten Einfluss auf die Performance

ALTER TABLE skripte
  ADD COLUMN IF NOT EXISTS hook_variante_1 text,
  ADD COLUMN IF NOT EXISTS hook_variante_2 text,
  ADD COLUMN IF NOT EXISTS hook_variante_3 text;

ALTER TABLE skript_versionen
  ADD COLUMN IF NOT EXISTS hook_variante_1 text,
  ADD COLUMN IF NOT EXISTS hook_variante_2 text,
  ADD COLUMN IF NOT EXISTS hook_variante_3 text;
