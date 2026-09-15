# Videoidee-Vorschläge sind flagged strategie_items, keine zweite Tabelle

Liky legt Videoideen im Konzept als `strategie_items.ist_vorschlag` an. Übernehmen nimmt das Flag und setzt `teilbereich` auf null (Ohne Kategorie); Verwerfen löscht die Zeile. Casting braucht eine eigene Tabelle (ADR 0013), weil der Creator schon existiert und Aktivieren den Typ wechselt – hier *ist* der Vorschlag die Videoidee, Payload ist `beschreibung`. Isolation gegenüber Gast/Kunde läuft über Review-Gates, Query-Filter und eine restriktive RLS-Policy, nicht über eine zweite Entität. `beschreibung_quelle = 'ki'` bleibt der Marker für KI-Text (auch die Llama-Beschreibung am Referenzvideo), nicht für den Vorschlag-Zustand.

## Considered Options

- **Eigene Tabelle analog `casting_vorschlag`:** saubere Gast-Isolation ohne Extra-Filter, aber Accept kopiert dieselbe `beschreibung` in `strategie_items`. Kein Typwechsel, doppelte Quelle.
- **Normale Videoideen ohne Flag:** kein Review, Kunde/Gast sähen den Pool sofort, Skript-Freigabe wäre das einzige Gate.

## Consequences

- Kunde/Gast laden keine Flag-Zeilen (Service + RLS). Solange das Flag steht: keine Creator-Zuordnung, keine Prio/Umgesetzt, keine Skript-Freigabe, kein Zu-Video.
- „Weitere Ideen“ addiert Flag-Zeilen; bestehende Erstzeilen der `beschreibung` gehen als Ausschluss in den Prompt.
