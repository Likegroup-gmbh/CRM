# Produkt-Einladung kann an einer Linie hängen

ADR 0055 hängt die Produkt-Einladung an Marke oder Unternehmen; an eine Linie kommt das angelegte Produkt erst per **Produkt übernehmen**. Geht die Einladung vom Produkte-Tab einer Linie aus, merkt sie sich die Linie (`einladung.briefing_id`), denn dort ist die Absicht schon bekannt, so wie die Briefing-Einladung die Produktion kennt. Der Eingang auf dem Tab zeigt nur die Einreichungen dieser Linie, Anlegen übernimmt das Produkt an sie.

## Considered Options

- **Wie ADR 0055 lassen**: Eingang auf dem Tab zeigt alle offenen der Marke, jemand muss das Produkt nach dem Anlegen von Hand an die Linie hängen. Die Absicht der Einladung geht verloren, bei mehreren Linien sieht jede den Eingang der anderen.

## Consequences

- Die Produkt-Einladung bleibt eine Marken-Einladung (Marke, sonst Unternehmen); die Linie kommt optional dazu. Aus der globalen Produktliste entsteht weiter eine Einladung ohne Linie. Dort stehen auch Linien-Einreichungen im Eingang, mit Hinweis auf die Linie. Anlegen hängt sie trotzdem an die Linie, egal wo geprüft wird.
- Fällt die Linie weg, bleibt die Einladung samt Einreichungen als Marken-Einladung bestehen (`ON DELETE SET NULL`), nichts Eingereichtes geht verloren.
- Gleicher Produktname: „Vorhandenes nehmen“ übernimmt das vorhandene Produkt an die Linie und verwirft die Einreichung. Ohne Linie bleibt es wie in ADR 0055 beim Verwerfen.
- Eine Produktion ohne Linie kann auf dem Produkte-Tab nicht einladen; der Button ist deaktiviert.
- Eingang, Zähler am Tab und „Kunde einladen“ laufen für Briefing und Produkt über je einen zentralen Pfad (`EinreichungInbox`, `kundeEinladen`), die Art ist nur Konfiguration.
