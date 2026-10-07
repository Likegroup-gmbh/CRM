# Casting gruppiert wieder nach eigenen Kategorien, die Persona-Achse entfällt

> Löst ADR 0019 und die Persona-Quote aus ADR 0020 ab: Gruppen und Quote hängen nicht mehr an den Briefing-Personas.

Ein Casting wird nicht mehr nach Briefing-Persona gegliedert. Eigene Kategorien (`creator_auswahl.teilbereich`, kommagetrennt) sind zurück, dazu die reservierten Eimer „Ohne Kategorie“ und „Nicht umsetzen“. Die Persona-Achse passt nicht zum geplanten Verschieben von Creatorn aus dem Casting-Bestand in ein Casting: dort gibt es keine Persona. Konzept-Kategorien bleiben unverändert.

Casting-Vorschläge laufen als eine Liste mit Quote 6 pro Casting. Das Briefing darf Personas haben; sie fließen als Hinweis in den Fit ein (je Creator zählt der beste Persona-Treffer), bilden aber keine Gruppen. Aktivieren legt den Eintrag unter „Ohne Kategorie“ an.

## Considered Options

- **Persona-Achse behalten und Bestand-Verschieben um eine Persona-Wahl ergänzen**: Pflichtfeld ohne Bezug zum Quellort.
- **Kategorie und Persona als zwei Achsen**: doppelte Gruppierung, unklare Reihenfolge in der Tabelle.

## Consequences

- `creator_auswahl_items.persona_id` bleibt an bestehenden Zeilen, weil Skripte die Persona des Eintrags lesen. Neue Einträge setzen sie nicht.
- Bestehende Persona-Einträge wurden per Migration `20261014_casting_kategorien_statt_persona.sql` einmalig zu Kategorien mit dem Persona-Namen. Offene Vorschläge laufen ohne Persona-Split weiter in „Ohne Kategorie“.
- Kommas sind in Kategorienamen nicht erlaubt (CSV-Trenner).
- Creator aus dem Casting-Bestand in ein Casting verschieben ist noch offen.
