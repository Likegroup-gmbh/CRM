# Produkt-Startrun schlägt genau eine neue, breite Persona vor

Liky am Produkt erzeugt im Startrun genau eine Persona: den breitesten tragfähigen Typ, immer `typ=neu`. Auto-Match auf den Unternehmens-Pool entfällt, obwohl `produkt_persona_vorschlag` Matches kann – Wiederverwenden bleibt manuell über „Bestehende hinzufügen“. Weitere breite Typen kommen nur per bewusstem +1, enge Typen über den Personas-Tab.

## Considered Options

- **Auto-Match der breitesten bestehenden**: spart Duplikate, würde aber Szenen-Personas als „die eine“ nehmen, sobald der Fit enger ist.
- **Fill-to-6 wie bisher**: deckt Nischen ab, die die meisten Kunden nicht brauchen.

## Consequences

- Zwei Produkte im selben Unternehmen können zwei ähnliche Typen anlegen. Reuse ist bewusst ein manueller Schritt.
- `modus=alle` (Auffüllen bis 6) gibt es nicht mehr.

## Nachtrag: Verfahren statt Adjektiv

"Breit" allein ("breitester tragfähiger Typ") reichte nicht: Die erste Persona für das iPhone Duo hieß "Mobil arbeitende Person mit hohem Produktivitäts- und Flexibilitätsanspruch", obwohl sie alle USPs nannte. Das Problem war nicht die Abdeckung, sondern die Identität: Sie hing an einem Nutzungskontext (Arbeit) statt an den Käufergruppen. Ursachen in den Live-Daten: Profile bestehender Personas als House-Style (die Duo-Persona kopierte die von Samsung S26 und Xiaomi 17T), "Berufstätig in Vollzeit" in fast jedem Startrun, arbeitslastige Extract-Pain-Points und keine Denkphase vor dem Tool-Call.

Entscheidungen:

- **Käufergruppen-Analyse im Schema vor Use Cases und Persona** (`produkt_kern`, `kaeufergruppen`, `gemeinsamer_nenner`, `berufsgebunden`). Die Persona ist der gemeinsame Nenner. Die Felder werden nicht gespeichert. Sie gelten für den breiten Lauf: `initial` und `karte` ohne andere aktive Karte. `weitere` sucht bewusst einen anderen Typ und bleibt unverändert.
- **Kein House-Style im breiten Lauf.** Der Pool liefert dort nur Vornamen (Dubletten-Schutz). In `weitere`/`karte` steht er als Abgrenzungsliste aus Name und Oberbegriff ("nicht klonen"). Das ersetzt die frühere Regel, Naming und Oberbegriff am Stil bestehender Personas auszurichten.
- **Beruf nur bei berufsgebundenen Produkten**, deterministisch: Ohne `berufsgebunden` leert die Validierung `beruf`.
- **Denkphase**: Persona-Job mit `thinking: true`, ein gemeinsamer Korrektur-Retry für Namens- und Breiten-Fehler (weniger als zwei Käufergruppen).

Verworfen: ein Breiten-Validator über USP- oder Use-Case-Abdeckung (die Duo-Persona hätte ihn bestanden) und eine Mindest-USP-Sperre im Gate (manuelle USPs stehen oft als Fließtext in einer Zeile).

Evaluation: `scripts/persona-eval/` (Fixtures aus echten Job-Inputs, Baseline-Zahlen und Live-Lauf).
