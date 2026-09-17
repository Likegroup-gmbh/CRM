-- Unterschiedliche Hooks: Checkbox plus Anzahl als Freitext.

ALTER TABLE campaign_briefings
  ADD COLUMN IF NOT EXISTS unterschiedliche_hooks boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hooks_anzahl text;

COMMENT ON COLUMN campaign_briefings.unterschiedliche_hooks IS
  'Ob das Briefing mehrere Hook-Varianten verlangt.';
COMMENT ON COLUMN campaign_briefings.hooks_anzahl IS
  'Anzahl der Hook-Varianten, wenn unterschiedliche_hooks wahr ist.';
