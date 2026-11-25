# Persona-Vorschlag wird beim Übernehmen materialisiert

Übernehmen im Drawer legt die Stammdaten-Persona sofort an. Der Produktsave schreibt nur den `produkt_persona_vorschlag`-Link und bricht bei pending-Karten mit einem Toast ab. Der Vorfall war ein Flow-Irrtum (Save = Übernehmen), kein stilles Drop nach einem Häkchen: ohne explizites Übernehmen bleiben Karten Vorschläge am Produkt.

## Considered Options

- **Erst beim Produktsave materialisieren**: ein Code-Pfad für Create und Edit, aber Personas fehlen in der Liste, solange das Produkt nicht gespeichert ist — und Speichern ohne Übernehmen legt sie weiter nicht an.
- **Save übernimmt alle pending-Karten still**: genau der Irrtum, den der Toast verhindern soll. Review im Drawer wäre optional.

## Consequences

- Verlassen ohne Produktsave lässt übernommene Personas stehen. Explizites Zurücknehmen dematerialisiert, wenn die Persona unbenutzt ist (kein anderer accepted-Link, kein Skript, keine DNA, kein Briefing).
