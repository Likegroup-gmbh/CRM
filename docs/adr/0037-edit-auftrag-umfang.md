# Edit-Auftrag hat einen Umfang

Der freie Chat im Skript-Editor drehte sich im Kreis: eine Anweisung wie „kein Wein“ traf nur die eine Zelle, die im kurzen Verlauf am lautesten war, und der komplette Rückfragen-Dialog wurde in jeden Edit gekippt. Der Edit hat einen Umfang. Alles oder ein benannter Teil liefert eine Liste von Zellen und ein Annehmen schreibt sie alle in eine Version. Die Ein-Zellen-Aktionen (Neu formulieren, Kürzen, Länger, Ton, Visual) und die Generierung bleiben.

## Considered Options

- **Pro Zelle eine Karte, einzeln annehmen.** Eine halbe Übernahme lässt das Verbot in den übrigen Zellen stehen. Abgelehnt.
- **Fünf-Phasen-Pipeline, die das ganze Skript neu schreibt.** Für 30–60 Sekunden der falsche Preis, wie in ADR 0035. Abgelehnt.
- **Jedes Verbot trifft immer beide Texte.** „Nicht erwähnen, aber zeigen“ würde das Brot auch aus der Regie werfen. Abgelehnt.
- **Rückfragen-Dialog bleibt im Edit-Prompt.** Der Edit verhandelt „Brot ist das Gericht“ gegen „Brot nicht erwähnen“ und fragt nochmal. Abgelehnt.

## Consequences

- Umfang steht im Text. Alles oder ein benannter Teil schlägt eine Markierung und öffnet Festgezogen in diesem Umfang. Kein Umfang und keine Markierung: eine Frage nach der Sektion, keine zweite.
- Das Verb entscheidet. „Nicht erwähnen“ trifft Was gesagt wird und Overlay-Text, „nicht zeigen“ nur Was zu sehen ist, „kein X“ ohne Trennung beides.
- `aenderung_abgeben` liefert `aenderungen`: Liste aus `{ sektion, spalte, vorschlag_text }`. Eine Message, eine Karte, ein Annehmen, eine Version. Ablehnen verwirft die ganze Liste. Ein späterer Accept auf einer der Zellen macht das ganze Bundle veraltet.
- Der Edit lädt den Rückfragen-Dialog nicht mehr. Festlegungen, das aktuelle Skript und die Anweisung reichen. Ein dauerhaftes Verbot schreibt im selben Turn die `festlegung`.
- Die Ein-Zellen-Regel aus ADR 0035 gilt weiter für die Buttons. Der freie Chat mit Umfang ist die Ausnahme.
