# Videolänge darf eine Mindestlänge sein

Ergänzt ADR 0032. Das Creator-Briefing fragt die Videolänge als Entweder-oder ab: „Mindestlänge X Sekunden“ oder „gewünschte Länge von X bis Y Sekunden“. Bisher war die Videolänge immer ein geschlossenes Intervall.

## Entscheidung

- **Speicherung:**
  - Mindestlänge: `videolaenge_von = X`, `videolaenge_bis = null`
  - Intervall: wie bisher beide Werte
  - Leer heißt weiter: keine Vorgabe

  Der CHECK `campaign_briefings_videolaenge_intervall` erlaubt `von` ohne `bis`, nie `bis` ohne `von`.
- **Skript:** Das Skript kopiert eine Mindestlänge als `X+` und plant Wortbudget und Bild-Zeitplan mit genau X Sekunden. Länger darf das Video werden, kürzer nicht.
- **Die Videolänge je Funnel-Stufe** wird nicht mehr abgefragt (ADR 0073). Vorhandene Werte bleiben lesbar, solange die Videoidee keine eigene Dauer hat.

## Verworfen

- **Nur das Intervall.** Wer im Kunden-PDF „mindestens 15 Sekunden“ ankreuzt, hätte im CRM keine Entsprechung.
- **Eigene Spalte `videolaenge_min`.** Zwei Felder für eine Untergrenze, die sich widersprechen können.
