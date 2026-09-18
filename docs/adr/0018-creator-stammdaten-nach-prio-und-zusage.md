# Creator-Stammdaten erst nach Kundenfeedback-Prio und Zusage/Gebucht; kein Buchungs-Wizard

`gebucht` öffnete einen Wizard (CRM, Management, Kooperation). Der unterbricht den Casting-Flow und legt Kooperationen zu früh an — die Kette ist Casting-Eintrag → Videoidee → Skript → Produktion. Stattdessen: Creator-Anlage und Videoidee nur im Aktionsmenü, und nur wenn der Kunde Prio 1/2 gesetzt hat und der Prozessstatus Zusage oder Gebucht ist. Ohne `creator_id` gibt es nur „Creator anlegen“; danach werden die Videoidee-Aktionen klickbar. Dieselbe Bedingung gilt beim Zuordnen auf der Konzept-Seite. Kooperation bleibt die spätere Brücke, nicht ein Folgeschritt der Buchung. Ergänzt ADR 0010, ersetzt ihn nicht.

## Considered Options

- **Wizard an `gebucht` lassen, nur UI umziehen**: dieselbe Kopplung, anderer Ort.
- **Anlage schon bei Prio, vor Zusage**: Stammdaten für Leute, die noch absagen.
- **Videoidee ohne `creator_id`**: Vertrag ohne Adresse/Firma/Management.

## Consequences

- Status-Regression und späteres `abgelehnt` reißen bestehende Videoidee-Zuordnungen nicht; Absage bleibt der Unlink.
- Liky-Aktivieren / CRM-Add behalten `creator_id`. Der Rot-Pfad gilt nur für Einträge ohne Identität.
