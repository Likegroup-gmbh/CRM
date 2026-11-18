# 0073 Skript-Upload: Skripte aus Word und PDF, ohne Liky-Entwurf und ohne Pflicht-Videoidee

Das Team schreibt viele Skripte in Word. In der LikeBase entsteht ein Skript bisher nur im Create-Drawer aus einer Videoidee mit Skript-Freigabe, danach stellt Liky Rückfragen und schreibt den ersten Entwurf (ADR 0011). „Skript anlegen“ nimmt deshalb zusätzlich eine `.docx` oder `.pdf` an. Mit Datei schreibt Liky nichts: der Wortlaut der Datei wird übernommen, das Skript steht als Entwurf im Editor und läuft von dort wie jedes andere weiter.

## Entscheidung

- **Zwei Wege im selben Drawer:** Ohne Datei bleibt ADR 0011 unverändert. Mit Datei ist das Konzept Pflicht, die Videoidee optional. Im Skripte-Tab einer Produktion setzt die aktive Linie das Konzept, in der allgemeinen Skript-Liste wird zuerst die Linie gewählt. Eine Linie ohne Konzept (Briefing-Entwurf) nimmt keinen Upload an.
- **Eine Datei, ein Skript:** `.docx` oder `.pdf`, bis 20 MB. Stehen mehrere Skripte darin, übernimmt Liky das, welches der Hinweis nennt, sonst das erste. Ein geschütztes oder kaputtes PDF wird abgelehnt, ein Scan nicht. Titel ist der Dateiname ohne Endung, Status `entwurf`, Herkunft `hochgeladen`. Version 1 heißt „Hochgeladen aus <Dateiname>“.
- **Zielzellen:** Die Skript-Tabelle mit Hook, Hauptteil und CTA, jeweils „Was gesagt wird“ und „Was zu sehen ist“, dazu Text-Hook, Rezept und Caption, sowie die Hook-Varianten Hook 1–3.
- **Word: Zuordnung über die Beschriftung.** Die erste Tabelle mit einer Zeile Hook, Hauptteil oder CTA füllt die Skript-Tabelle, eine Tabelle mit Hook 1–3 die Hook-Varianten. Groß- und Kleinschreibung zählt nicht. Der Text wird mechanisch kopiert, Fett und Kursiv bleiben. Offene Änderungen gelten als angenommen, Word-Kommentare fallen weg. Dieselbe Zeile in einer späteren Tabelle überschreibt nichts.
- **PDF: Liky ordnet zu.** Das PDF läuft serverseitig durch Liky wie Rechnung, Kundenbriefing, Produkt und Persona. Der Auftrag ist nur zuordnen und wörtlich übernehmen, nie umformulieren. Fett und Kursiv entfallen. Liky liest auch Scans. Weil der Wortlaut so nicht garantiert ist, zeigt der Editor „Von Liky gelesen, bitte Wortlaut prüfen“, bis das Skript zum ersten Mal gespeichert wird.
- **Hinweise für Liky:** Ein optionales Textfeld im Drawer, bis 2000 Zeichen. Ohne Datei steht es im Auftrag und geht in Rückfragen und Erstellung; was dort geklärt ist, fragt Liky nicht nochmal. Mit PDF sagt es Liky, was übernommen wird und wo Zellen stehen. Eine Word-Datei mit Hinweis liest ebenfalls Liky, als Text mit Fett und Kursiv als Markierung, und der Editor zeigt die Prüf-Meldung wie beim PDF; ohne Hinweis bleibt die mechanische Zuordnung. Der Hinweis gilt nur beim Anlegen, spätere Liky-Aufträge im Editor sehen ihn nicht.
- **Bilder ohne Liky:** Eingebettete Bilder werden getrennt aus der Datei gezogen, auch beim PDF, wo Liky nur Text liefert. Sie stehen immer unter der Skript-Tabelle in der Reihenfolge der Datei, weil eine Zelle der Skript-Tabelle nur Text hält.
- **Alles andere unter die Skript-Tabelle:** Text ohne Zielzelle und weitere Tabellen werden Freie Blöcke unter der Skript-Tabelle, in der Reihenfolge der Datei. Eine Tabelle über 12 × 12 wird auf mehrere verteilt. Passt nichts in eine Zielzelle, bleibt die Skript-Tabelle leer und der ganze Inhalt steht darunter.
- **Die Datei wird nicht gespeichert.** Es gibt eine Fassung, die im Editor. Auch die temporäre Datei für Liky wird nach dem Lesen gelöscht.
- **Videoidee:** Wird im Drawer eine gewählt, gilt die Skript-Freigabe, und Funnel-Stufe, Videolänge und Persona werden wie beim Liky-Weg kopiert. Hängt an der Idee schon ein Skript, entsteht ein weiteres, der Drawer weist darauf hin. Später im Editor lässt sich eine Idee desselben Konzepts auch ohne Skript-Freigabe setzen; „Nicht umsetzen“ und Vorschläge bleiben gesperrt. Das erste Skript friert die Creator-Zuordnung der Idee ein wie bisher.
- **Hook-Sperre:** Hat die Idee einen gesperrten Hook, gilt trotzdem der Hook aus der Datei, wie bei jeder Änderung von Hand. Der Editor zeigt die Abweichung, Liky ändert den Hook weiter nicht.

## Verworfen

- **Liky ordnet jedes Word zu.** In Word steht die Tabelle in der Datei selbst; die Beschriftung ist eindeutig und der Wortlaut bleibt garantiert gleich. Liky braucht es nur, wo die Struktur aus dem Seitenlayout erschlossen werden muss oder ein Hinweis eine Auswahl verlangt.
- **Hinweis bleibt am Skript.** Spätere Überarbeitungen hätten eine Auswahl wie „nur Skript 2“ als Vorgabe für den Inhalt missverstanden. Was dauerhaft gilt, gehört in Videoidee, Briefing oder die Vorgaben im Editor.
- **Eigene, mechanische PDF-Erkennung.** Ein PDF kennt nur Text an Positionen; verbundene Zellen, Tabellen über mehrere Seiten und Scans erkennt sie schlecht. Das Lesen über Liky gibt es schon und kann das.
- **Ganzer Text in den Hauptteil.** Kommentare, Versionen, Festgezogen und Liky-Aufträge arbeiten pro Zelle; ein Block im Hauptteil hätte das Team von Hand auseinanderschneiden müssen.
- **Datei zusätzlich am Skript ablegen.** Zwei Fassungen, die auseinanderlaufen, sobald jemand im Editor arbeitet.
- **Videoidee wie im Liky-Weg Pflicht.** Word-Skripte entstehen oft, bevor die Idee im Konzept steht. Die Skript-Freigabe ist der Startschuss für Likys Schreiben, und den gibt es beim Upload nicht.
- **Nur `.docx`.** Skripte kommen auch als PDF.

## Folgen

- Ohne Videoidee fehlen Persona, Funnel-Stufe, Videolänge und Skript-Nummer. Einen Creator hat das Skript erst über die Idee oder ein verknüpftes Kooperationsvideo; bis dahin erscheint es im Skript-Anschreiben bei keinem Creator. Die Persona lässt sich im Editor über die Vorgaben setzen.
- Der Kunde sieht ein hochgeladenes Skript sofort und darf es bearbeiten, wie jedes Skript im Entwurf.
- Ein PDF-Upload kostet einen KI-Aufruf und dauert entsprechend, ein Word-Upload nur mit Hinweis. Eine Word-Datei mit Hinweis darf höchstens 100.000 Zeichen Text haben.
- Nach dem Upload läuft Liky erst auf Auftrag im Editor und liest dann nur die Skript-Tabelle; die Freien Blöcke aus dem Upload sieht Liky nie (ADR 0062).
