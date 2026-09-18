# Casting-Vorschläge pro Briefing-Persona, Quote 6

Globales Top-N (ADR 0014) füllte eine Liste; Persona-Gruppen (ADR 0019) blieben leer, wenn das LLM `persona_ids` ließ. Matching läuft jetzt je Briefing-Persona gegen die volle Karte plus accepted Produkt-Fit. Jeder Vorschlag hängt an genau einer Persona. Pending werden auf 6 pro Persona aufgefüllt (Löschen → Lücke nachziehen), bestehende Zuordnungen bleiben stehen. Ohne-Persona-Pending wandern greedy in offene Slots. Das LLM erklärt und darf streichen, weist keine Persona zu und füllt die Quote nicht — nach Streichen zieht der Code deterministisch nach.

## Considered Options

- **Regen aller pending**: würde die 4 behaltenen Vorschläge einer Gruppe wegwerfen.
- **Briefing-Reihenfolge statt Greedy**: die erste Persona nähme die Generalisten.

## Consequences

- Kampagnen-Soll steuert die Vorschlagsquote nicht. Ranking in der Gruppe bleibt Matching (ADR 0014).
- Aktivierte Einträge werden nicht umgehängt und zählen nicht gegen die 6.
