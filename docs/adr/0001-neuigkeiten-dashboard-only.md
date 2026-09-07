# Neuigkeiten nur noch als Dashboard-Cards, ohne Screenshots

Die automatisch generierten Update-Notizen (siehe **Neuigkeit** in CONTEXT.md) hatten eine eigene Seite (`/neuigkeiten` + Detail), tutorialartige Sie-Texte mit „So geht's"-Schritten und Puppeteer-Screenshots aus der GitHub Action. Niemand hat die Seite gelesen — der Aufwand (Screenshot-Infrastruktur, eigene Routes, Archiv) stand in keinem Verhältnis zum Nutzen. Entschieden: Neuigkeiten sind kurze Du-Texte (titel + kurztext, 1–3 Sätze), die vollständig in Cards auf dem Dashboard stehen; alte Meldungen wurden einmalig per Claude umgeschrieben.

## Consequences

- Die Spalten `slug`, `teaser`, `schritte` wurden per Migration `20260904_neuigkeiten_umbau.sql` gelöscht. Der Storage-Bucket `neuigkeiten` wird manuell im Supabase-Dashboard gelöscht (direktes SQL-DELETE blockiert der `storage.protect_delete`-Trigger) — die alten Screenshots sind damit unwiderruflich weg.
- Es gibt bewusst kein Archiv und keinen Gelesen-Status: ältere Meldungen sind über „Alle anzeigen" auf dem Dashboard erreichbar, ein „Neu"-Badge (< 7 Tage, rein datumsbasiert) ersetzt das Tracking.
- Die Generierungs-Pipeline (Push auf main → Claude → Insert) bleibt, braucht aber keinen Netlify-Deploy-Wait und keine Puppeteer-/Login-Secrets mehr (`WHATSNEW_LOGIN_*`, `NETLIFY_*`, `PRODUCTION_URL` können aus den GitHub-Secrets entfernt werden).
