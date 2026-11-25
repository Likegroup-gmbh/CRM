# Eine Kooperation wechselt die Linie, nicht die Kampagne

Altbestand liegt nach ADR 0058 in Produktionen und Altbestand-Linien. Falsche Tag-Gruppen korrigiert das Team an der Kooperation. Die Kooperation sitzt auf der Linie, die Produktion folgt daraus. `kampagne_id` bleibt, weil Topf, Rechte und Dropbox an der Kampagne hängen.

## Entscheidung

- Das Aktionsmenü „In andere Linie verschieben“ öffnet den Such-Dialog. Ziel sind die fertigen Linien und die Altbestand-Linien derselben Kampagne, die aktuelle Linie und Entwürfe nicht. Eine neue Linie legt der Dialog nicht an.
- Die Kooperation bekommt `briefing_id` und `produktion_id` der Ziellinie. Hat die Zielproduktion ein Produktionsbudget und die Verkaufspreise ihrer Videos würden es überschreiten, bleibt sie liegen. Produktionen ohne eigenes Budget teilen den Kampagnen-Topf und haben diese Sperre nicht.
- Kooperationsvideos und Rechnungen haben keine eigene Produktion. Sie folgen der Kooperation.
- Skript und Videoidee ziehen mit, wenn nur Videos dieser Kooperation darauf zeigen. Die Videoidee wechselt ins Konzept der Ziellinie. Persona und Produkt bleiben an ihr. Zeigt noch ein Video einer bleibenden Kooperation auf dasselbe Skript oder dieselbe Videoidee, bleiben beide im alten Konzept.
- Der Casting-Eintrag einer mitziehenden Videoidee zeigt auf den vorhandenen Eintrag derselben Creator-ID im Ziel-Casting. Sonst wird er kopiert, wenn er noch an einer bleibenden Idee hängt, oder er zieht selbst mit. Status und Kunden-Prio bleiben. Die Kategorie wird „Ohne Kategorie“, außer das Ziel-Casting führt denselben Namen. „Nicht umsetzen“ bleibt. Ohne Creator-Datensatz gibt es keine Zuordnung über den Namen. Eine Konzept-Einladung bleibt an dem Eintrag, der liegen bleibt.
- Die Produktions-Zuordnung eines Vertrags folgt der Erzeuger-Kooperation. Deckung, PDF und Status bleiben. Contracting bleibt außen.
- Der Vorgang gilt zusammen. Schlägt ein Teil fehl, bleibt der Ausgangsstand.

## Considered Options

- **Skript und Videoidee bleiben immer liegen:** Die Ziellinie zeigt die Buchung und die Dateien, der Skripte-Tab bleibt für diesen Creator leer.
- **Geteilte Ideen trotzdem mitziehen:** Dieselbe Videoidee läge in zwei Konzepten, oder die bleibende Kooperation verlöre sie.
- **Jeder gedeckte Vertrag zieht mit:** Ein Vertrag über mehrere Kooperationen verschwände aus der Produktion, in der die andere Buchung liegen bleibt.
- **Casting-Eintrag immer löschen und neu anlegen:** Eine Konzept-Einladung am bleibenden Eintrag würde widerrufen.

## Consequences

- Ein kopierter Casting-Eintrag bleibt im anderen Casting, wenn die Kooperation zurückgeschoben wird.
- Persona und Produkt an der Videoidee können auf einer Altbestand-Linie stehen, deren Briefing sie nicht führt. „Briefing ausfüllen“ ist ein eigener Schritt.
