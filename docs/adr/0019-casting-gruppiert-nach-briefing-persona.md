# Casting gruppiert nach Briefing-Persona, nicht nach Freitext-Kategorie

Casting-Listen hatten frei benennbare Kategorien (`teilbereich` CSV + `items.kategorie`). Die KI matchte Namen dagegen, die Tabelle zeigte tote Gruppen, sobald jemand umbenannte. Gruppenköpfe kommen jetzt live aus `campaign_briefings.persona_ids`; der Eintrag trägt `persona_id`. Freitext-Kategorien am Casting entfallen — `kategorie` bleibt nur für den Eimer „Nicht umsetzen“. Konzept-Kategorien sind unverändert.

## Considered Options

- **CSV weiter mit Persona-Namen füllen**: Rename-Bugs bleiben, keine FK.
- **Mehrere Listen pro Persona**: Extra-Ebene, die der Casting-Flow nicht braucht.

## Consequences

- Bedarf (KI) und Tabelle teilen dieselbe Persona-Liste. Eintrag ohne Persona ist Altbestand (`Ohne Persona`).
- Briefing-Personas nachträglich ändern blendet neue Gruppen ein; verwaiste `persona_id` bleiben als Orphan sichtbar.
