# Briefing-Produkte nur über den Persona-Fit

Ein Briefing wählt Personas (`campaign_briefings.persona_ids`). Die Briefing-Produkte sind die Union der accepted `produkt_persona_vorschlag`-Zeilen dieser Personas. `campaign_briefing_produkt` bleibt die Lesetabelle für Casting und Konzept, wird aber nur noch als Projektion geschrieben, nicht mehr per Picker am Briefing.

Membership bleibt das Array `persona_ids`: Casting, Bedarf und ADR 0019 lesen es bereits. Ein `personas.briefing_id` würde die n:n-Wiederverwendung (dieselbe Mutti an Sommer und Weihnachten) zerlegen. Ein Direkt-Picker parallel zur Kette würde wieder zwei Wahrheiten führen.

## Considered Options

- **`personas.briefing_id`**: klare 1:n-Kante, aber dieselbe Persona in zwei Briefings zwingt zur Kopie und spaltet Audience Situations.
- **Direkt-Picker plus Kette**: UI-Reihenfolge ohne Modellwechsel; `campaign_briefing_produkt` und Persona-Fit laufen auseinander.
- **Junction `briefing_persona`**: referentielle Integrität, aber doppelte Quelle neben `persona_ids` und ein Schnitt durch Casting/Bedarf.

## Consequences

- Briefing-Create/Edit setzt keine Produkte und Personas mehr; Finalisieren geht ohne beides.
- Anhängen passiert am Persona-Formular und am Briefing-Detail; Accept/Delete am Produkt-Fit rechnet die Projektion nach.
- Altbestand ohne Fit fällt bei der Migration von der Junction.
