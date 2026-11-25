# 0081 Auswertung ohne Engagement-Rate, Posts je Creator

Die Engagement-Rate (Interaktionen ÷ Betrachter bei Instagram bzw. ÷ Aufrufe bei TikTok) stand als Kachel, als Spalte, im Post-Panel und im Report-PDF. Sie ist gewünscht raus: Kunden lesen die Rohzahlen, und die gemischte Basis je Plattform ließ sich im Call schwer erklären. Außerdem fielen Kacheln ohne Wert weg (z. B. Sticker-Taps ohne Stories), und der Aufbau des Reports wechselte je nach Kampagne. Die Post-Tabelle zeigte jeden Post einzeln; welcher Creator noch etwas schuldet, war nicht auf einen Blick zu sehen.

## Entscheidung

- **Keine Engagement-Rate mehr**, nirgends: Kacheln, Tabelle, Unterzeile beim Filtern, Post-Panel, Report-PDF. An ihre Stelle treten die Interaktionen (Σ Likes, Kommentare, Geteilt, Gespeichert, Antworten). Die Bezugsgröße je Plattform (`basis`) gibt es nicht mehr.
- **Kacheln = Spalten der Tabelle:** Aufrufe, Likes, Kommentare, Betrachter, Interaktionen, Ø Wiedergabe, Link-Klicks, Sticker-Taps, dazu Kosten pro 1.000 Aufrufe mit Preis-Sicht. Eine Definition (`auswertungKacheln.js`) für Report und PDF-Deckblatt.
- **Jede Kachel steht immer da.** Ohne Grundlage zeigt sie „–“ und woher der Wert käme („nur Instagram-Stories“). Sie wird nie zu 0.
- **Post-Tabelle je Creator wie die Kooperationstabelle:** je Creator ein `<tbody>`, Rang und Creator einmal links über alle seine Zeilen. In der Creator-Zelle stehen die Aufrufe der Gruppe und fürs Team der Stand („2 ausgewertet · 1 prüfen · 1 fehlt“), für Kunden die Anzahl der Posts. Die Gruppen sortieren nach der Summe der Spalte (bei Ø Wiedergabe nach dem Mittel), die Posts darin nach der Spalte selbst.
- **Rang je Creator** nach den Aufrufen aller bestätigten Posts der Ebene, unabhängig von Sortierung und Filter. Die Top 3 bleiben markiert.
- **Report-PDF:** Reel, Post und TikTok zeigen Aufrufe, Likes, Kommentare und Interaktionen. Das Deckblatt zeigt immer alle acht Kennzahlen (4 × 2). Die Kacheln je Post bleiben nach Aufrufen sortiert, ohne Gruppierung.

## Verworfen

- **Engagement-Rate nur ausblenden.** Dann rechnet der Code weiter etwas, das niemand sieht, und taucht beim nächsten Export wieder auf.
- **Aufklappbare Gruppen.** Die Kooperationstabelle klappt auch nicht. Zugeklappt wäre der Stand je Post wieder versteckt.
- **Eine Zeile je Creator mit gestapelten Werten in den Zellen** (wie `video-fields-stack`). Das braucht einen Höhenabgleich per JS. `rowspan` im eigenen `<tbody>` richtet die Zeilen von selbst aus und lässt sich als Block animieren.

## Folgen

- Offene Zeilen zeigen alle schon gelesenen Rohwerte (auch Betrachter, Link-Klicks, Sticker-Taps). Nur die Interaktionen bleiben bis zum Bestätigen „–“.
- `wechsleZeilen` tauscht nur Kinder mit `data-flip-id`. So bleibt das `<thead>` samt Fokus stehen, und die Gruppen gleiten als Ganzes.
