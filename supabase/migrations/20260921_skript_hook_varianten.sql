-- Alternative gesprochene Hooks (Hook 1–3) am Skript, nicht als Extra-Versionen.

ALTER TABLE skripte
  ADD COLUMN IF NOT EXISTS hook_variante_1 text,
  ADD COLUMN IF NOT EXISTS hook_variante_2 text,
  ADD COLUMN IF NOT EXISTS hook_variante_3 text;

ALTER TABLE skript_versionen
  ADD COLUMN IF NOT EXISTS hook_variante_1 text,
  ADD COLUMN IF NOT EXISTS hook_variante_2 text,
  ADD COLUMN IF NOT EXISTS hook_variante_3 text;

COMMENT ON COLUMN skripte.hook_variante_1 IS
  'Alternativer gesprochener Hook 1. Tausch mit hook intern ueber Hook uebertragen.';
COMMENT ON COLUMN skripte.hook_variante_2 IS
  'Alternativer gesprochener Hook 2.';
COMMENT ON COLUMN skripte.hook_variante_3 IS
  'Alternativer gesprochener Hook 3.';
