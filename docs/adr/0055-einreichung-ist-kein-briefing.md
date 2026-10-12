# Einreichung ist kein Briefing

Kunden füllen Produkt und Briefing über eine Einladung (Link plus Code, kein Konto) selbst aus. Das Abgeschickte liegt als Einreichung in einem eigenen Eingang. Produkt- und Briefing-Listen lesen es nicht. Erst **Anlegen** durch einen Mitarbeiter schreibt in `produkt` oder `briefing`. So landet nichts Ungeprüftes im Katalog oder in einer Linie, und das Schema von Produkt und Briefing bekommt keine Statusspalte für Fremdeingaben.

## Considered Options

- **Status-Flag auf `produkt`/`briefing`**: Jede Liste, jeder Picker und jedes Matching müsste das Flag ausblenden. Ein vergessener Filter zeigt Fremdeingaben als echtes Briefing. Entwurf gibt es schon und bedeutet etwas anderes.
- **Kunden-Login**: Ein Konto pro Besucher für ein einmaliges Formular. Zu schwer für den Zweck.
- **Briefing-Einladung am Unternehmen, Produktion wählt der Mitarbeiter beim Anlegen**: Der Kunde kennt die Produktion nicht, die Zuordnung ginge verloren. Die Einladung entsteht deshalb in der Produktion.
- **Liky, Chat und PDF-Auslesen auf dem Kundenformular**: Ein offener KI-Aufruf hinter einem Link. Der Kunde tippt alles selbst.

## Consequences

- Zwei Formulare, je ein Absenden. Danach bietet die Einladung „noch eins“ an. Jedes Absenden ist eine neue Einreichung.
- Briefing-Einladung nur aus der Produktion. Der Mitarbeiter setzt den Briefing-Typ (Paid, Organic, Influencer) beim Einladen, der Kunde sieht nur die Felder dieses Typs. Anlegen erzeugt ein Briefing als Entwurf und damit die Linie. Füllt der Kunde nichts aus, entsteht nichts.
- Produkt-Einladung trägt die Marke, ohne Marke das Unternehmen. Das Formular fragt sie nicht. Anlegen legt das Produkt in den Katalog. An eine Linie kommt es über **Produkt übernehmen**.
- Review: Felder korrigieren, dann Anlegen oder Verwerfen. Die abgeschickte Einreichung bleibt unverändert, wie der Kunde sie geschickt hat.
- Gleicher oder ähnlicher Produktname in der Marke: Das System warnt. „Vorhandenes nehmen“ verwirft die Einreichung, das alte Produkt bleibt. „Trotzdem neu“ legt ein zweites an. Felder werden nicht zusammengeführt.
- Sichtbar für den Kunden sind die inhaltlichen Felder des jeweiligen Formulars mit Hilfetexten, dazu Produktbilder und Referenzdateien. Intern bleiben Zuordnung, TKP, Verhandlungshinweis, Unternehmens- und Markenauswahl und Personas.
- Pro Einreichung geht eine Mail an die Person, die eingeladen hat. Link und Code kopiert der Mitarbeiter, wie beim Zugang.
- Schreibzugriff ohne Konto braucht eine eigene Sicherung: Der Code wird nur gehasht gespeichert, die Einladung ist widerrufbar, und das Absenden läuft über serverseitige Prüfung statt über offene anon-Policies auf `produkt` und `briefing`.
