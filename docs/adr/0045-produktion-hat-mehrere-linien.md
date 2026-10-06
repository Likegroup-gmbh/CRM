# 0045 Eine Produktion hat mehrere Linien

Bisher war die Produktion 1:1 mit ihrem Briefing: Finalisieren legte genau eine Produktion samt Casting und Konzept an (0029), Produktionen ohne Briefing waren versteckt und wurden über `ziel_produktion_id` gewählt (0035), und die Produktion hieß wie das Briefing (0041). In der Praxis braucht eine Produktion mehrere Briefings (etwa Nano-Influencer und UGC-Creator mit 20.000 Followern). Jedes braucht ein eigenes Casting und Konzept, weil beide auf den Briefing-Daten aufbauen und bei gemischten Briefings falsche Ergebnisse liefern würden.

## Entscheidung

- Die Produktion ist ein Container unter der Kampagne. Sie entsteht mit dem Auftrag (N Stück, Budget optional) oder von Hand, ist immer sichtbar und trägt keine Briefing-Spalte mehr.
- Briefing, Casting, Konzept, Skripte und Kooperationen bilden eine **Linie**. Die Zuordnung steht am Briefing: `campaign_briefings.produktion_id` (Pflicht im Formular). Casting und Konzept tragen weiter `briefing_id`, pro Briefing genau ein Paar (Unique-Index).
- Finalisieren legt Casting und Konzept der Linie an; ein Entwurf erscheint im Linien-Switcher mit Badge, legt aber nichts an.
- Der Produktionsname ist vor dem ersten Briefing `Projektname – Produktion N`. Beim Finalisieren der ersten Linie wird der Briefing-Titel einmalig übernommen, danach folgt der Name keinem Briefing mehr. Casting und Konzept folgen weiter ihrem Briefing.
- Das Produktionsbudget bleibt an der Produktion, alle Linien teilen es.
- Die Kooperation trägt die Linie. Derselbe Creator in zwei Linien ergibt zwei Kooperationen. Verträge und Videos hängen über die Kooperation an der Linie.
- In der Produktion zeigen Briefing, Produkte, Personas, Casting, Konzept und Skripte immer genau eine Linie (`?linie=<briefingId>`, zuletzt genutzte als Default). Produktion, Verträge und Videos haben zusätzlich "Alle Linien". Zwischen Produktionen derselben Kampagne wechselt ein Switcher in der Breadcrumb.
- Die geplante Anzahl im Auftrag lässt sich nur erhöhen. Eine Linie ist nicht löschbar, sobald sie Kooperationen hat. Eine Produktion ist nur ohne Linien und ohne Entwürfe löschbar.
- Bestand: Jede Produktion mit Briefing wird zu einer Produktion mit einer Linie. Bisher versteckte Produktionen ohne Briefing werden sichtbar. Keine Zusammenlegung.

Löst 0029 ab. Ersetzt von 0035 den Teil "Produktionen ohne Briefing sind versteckt, Picker `ziel_produktion_id`" und von 0041 den Teil "Produktion mit Briefing heißt wie das Briefing".

## Considered Options

- **Eine Produktion pro Briefing**: Die Produktion wäre redundant zum Briefing, und der Auftrag könnte keine Produktionen im Voraus anlegen.
- **Ein gemischtes Casting und Konzept über zwei Briefings**: Die Listen lesen geteilte Briefing-Informationen, Vorgaben beider Briefings vermischen sich und erzeugen Fehler.
- **`briefing_id` an der Produktion behalten**: Das erlaubt nur ein Briefing pro Produktion.
