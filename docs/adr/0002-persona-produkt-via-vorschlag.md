# Persona-Produkt-Verknüpfung über die Vorschlags-Tabelle

Personas bekommen ein Produktfeld (Mehrfachauswahl, beidseitig sichtbar). Statt einer zweiten Junction `persona_produkt` bleibt `produkt_persona_vorschlag` die einzige Quelle: `status = 'accepted'` ist die Verknüpfung. Eine zweite Tabelle würde dieselbe Beziehung doppelt führen und müsste mit dem KI-Review-Lifecycle synchronisiert werden.

## Consequences

- Das Persona-Formular schreibt `accepted`-Rows direkt (Diff statt Delete-all), damit pending KI-Karten und `fit_grund` / `use_case_ids` erhalten bleiben.
- Abhängen vom Persona-Formular setzt `status = 'deleted'`, ruft aber **nicht** `dematerialize` auf: die Persona wird gerade editiert und darf nicht gelöscht werden (typ `neu`). Verwerfen am Produkt bleibt unverändert inkl. dematerialize und Marken-Rollback.
- Beim Anhängen vom Persona-Formular werden fehlende Produkt-Marken an `persona_marke` gehängt und in `payload._attached_marke_ids` protokolliert, damit ein späteres Verwerfen am Produkt sie wieder abziehen kann.
