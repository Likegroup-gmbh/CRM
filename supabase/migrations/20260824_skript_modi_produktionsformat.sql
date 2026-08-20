-- Visuelle Regie-Modi: Produktionsbriefing statt Filmhochschul-Storyboard.
-- Dynamisch = mehr Szenen/Props, aber weiterhin 5–10s-Bloecke (kein 0,5–2s).

UPDATE skript_modi SET
  inhalt = 'Ruhige, klare visuelle Regie im Produktionsformat. Wenige Blöcke: 1–2 Visuals plus Text Overlay, dazu höchstens eine B-Roll. Zeitmarker alle 5–10 Sekunden, keine sekündlichen Shots. Sprache wie ein Creator-Briefing (Text Overlay, Visual, B-Roll) – kein Filmhochschul-Storyboard. B-Roll und Overlays nur dort, wo sie die Aussage tragen. Stil, Orte und Props über die Sektion hinweg konsistent halten.'
WHERE slug = 'klassisch';

UPDATE skript_modi SET
  inhalt = 'Dynamische visuelle Regie im Produktionsformat: mehr Szenen, mehr Props, mehr Wechsel zwischen Visual und B-Roll als im klassischen Modus. Trotzdem Blöcke von 5–10 Sekunden, keine 0,5–2-Sekunden-Schnitte und kein sekündliches Storyboard. Mehrere Visuals und Overlays sind erwünscht, Sprache bleibt Creator-Briefing (Text Overlay, Visual, B-Roll). Stil, Orte und Props konsistent halten, Zeitmarker nahtlos anschließen. Kein Sprechertext.'
WHERE slug = 'dynamisch';
