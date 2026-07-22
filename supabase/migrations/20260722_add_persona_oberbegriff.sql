-- Personas: Oberbegriff als eindeutiges Benennungsschema.
-- Der Name bleibt der "Charaktername" (z.B. "Sarah"), der Oberbegriff ist die
-- Kategorie zur besseren Zuordnung (z.B. "Sparsame Studentin").
ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS oberbegriff varchar;
