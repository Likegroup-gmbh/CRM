# 0041 Der Projektname ist die Basis der Namenskette

Kampagne, Produktion, Briefing, Casting und Konzept eines Projekts hießen mal so, mal so: Der Wizard setzte den Projektnamen, Altpfade in `AutoGeneration` erzeugten `Kürzel - Monat - Art`, `Sourcing - X` und `Strategie X`, Produktionen ohne Briefing hießen `Produktion N`, und der Briefing-Titel war frei.

## Entscheidung

- Projektname = `auftrag.titel`. Die Kampagne trägt ihn als `kampagnenname` (weitere Kampagnen: `Projektname (2)`). Das ist die Basis.
- Abgeleitete Namen nehmen immer `kampagne.kampagnenname`, nie `eigener_name`. `eigener_name` bleibt eine reine Anzeige-Überschreibung der Kampagne.
- Briefing-Titel = Basis, bei Bedarf `Basis – Zusatz` (Drawer: Basis fest, Zusatz optional). Das Briefing-Formular hat kein Titelfeld mehr: `aktivierung_name` kommt aus dem Drawer (`?titel=`), aus dem Bestand oder, sonst beim Speichern, aus `kampagne.kampagnenname`.
- Der Drawer auf einer Produktion nimmt als Basis den eigenen Produktionsnamen, sofern er nicht dem Automatikschema `… Produktion N` folgt; sonst den Projektnamen (`briefingBasis`).
- Produktion mit Briefing heißt wie das Briefing. Produktion ohne Briefing heißt `Basis – Produktion N`.
- Casting = `{Briefing-Titel} Casting`, Konzept = `{Briefing-Titel} Konzept`. Die Altpfade für Casting- und Konzept-Anlage ohne Briefing nutzen dasselbe Schema (`lineNames`).
- Die Kampagnenform im Altpfad nimmt den Projektnamen des Auftrags; nur ohne Projektname greift das alte Schema.
- Alle Helfer liegen in `src/modules/produktion/produktionNames.js`.

## Leistungszeitraum

Kernlisten mit Kampagnenbezug (Kampagnen, Produktionen, Briefings, Casting, Konzepte, Skripte, Kooperationen) zeigen eine Spalte `Leistungszeitraum`, formatiert von `src/core/utils/leistungszeitraum.js` (`01.03. – 31.05.2026`). Quelle ist `auftrag.start`/`ende`, Fallback `kampagne.start`/`deadline`. Die Kampagnenliste liest aus der RPC `get_kampagnen_list`, die `auftrag.start/ende` nicht liefert, und fällt deshalb auf `kampagne.start` und `deadline_post_produktion` zurück; der Wizard schreibt dort denselben Zeitraum.

## Folgen

- Kein Backfill. Bestehende Namen bleiben, wie sie sind.
- Keine Kaskade: Wird der Projektname später geändert, ziehen vorhandene Briefings, Produktionen, Castings und Konzepte nicht nach.
- Wird der Zeitraum einer Kampagne nach dem Anlegen abweichend zum Auftrag geändert, zeigt die Kampagnenliste den Kampagnenwert, die übrigen Listen den Auftragswert.
