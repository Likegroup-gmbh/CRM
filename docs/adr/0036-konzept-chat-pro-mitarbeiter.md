# Konzept-Chat: ein Faden pro Mitarbeiter

Liky am Konzept nimmt Feedback an Videoidee-Vorschlägen über den Chat entgegen (Umschreiben, Verwerfen, Neu, Ersetzen). Der Verlauf liegt in `konzept_chat_messages` und hängt an `strategie_id` **und** `created_by`: jeder Mitarbeiter hat seinen eigenen Faden. Briefing (`briefing_chat_messages`) und Skript (`skript_chat_messages`) teilen sich den Faden dagegen über alle.

Grund: „die“ und „nochmal“ binden an die Vorschläge, die Liky in der letzten eigenen Antwort gemeint hat (`bezug_ids`). In einem geteilten Faden würde „die“ an den letzten Turn einer anderen Person binden und deren Vorschläge treffen. Die Tabelle selbst ist weiterhin gemeinsam: zwei Personen, die dieselbe Zeile umschreiben, überschreiben sich; der spätere Text bleibt.

## Considered Options

- **Ein Faden pro Konzept** wie Briefing und Skript: Kolleginnen sähen, was Liky schon gefragt wurde. Aber Pronomen und „nochmal“ wären nicht mehr eindeutig, sobald zwei Personen parallel Feedback geben.
- **Kein gespeicherter Verlauf**: nach Reload ist der Kontext weg, „die“ funktioniert nur in derselben Sitzung.

## Consequences

- RLS: `created_by = auth.uid()`, nur Staff. Die Background-Function schreibt die Assistant-Antwort mit `created_by` des Fragestellers in denselben Faden.
- Ersetzen entwirft zuerst und verwirft die genannten Zeilen erst, wenn die neuen liegen – ein leerer Lauf löscht nichts.
