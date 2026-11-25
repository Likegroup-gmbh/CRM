# Casting-Bestand legt markierte Personen auf ein Casting, auch ohne Creator-Datensatz

> Schließt den offenen Punkt aus ADR 0049 („Creator aus dem Casting-Bestand in ein Casting verschieben“).

Auf Creator Casting schaltet der Button „Zu Casting hinzufügen“ einen Auswahlmodus ein: Checkbox-Spalte, Zeilenklick markiert, eine schwebende Leiste wählt das Ziel-Casting und optional eine Kategorie. Die Bestandszeile bleibt, jede markierte Person wird ein neuer Casting-Eintrag (Typ Influencer, ohne `persona_id`, ohne Kategorie unter „Ohne Kategorie“).

Zeilen ohne Creator-Datensatz (roter Punkt) sind wählbar. Sie werden Einträge ohne `creator_id` mit Name, Instagram, TikTok, Follower, Stadt und Bild aus dem Bestand; es entsteht kein Creator. Grüne Zeilen kopieren die Stammdaten und setzen `creator_id`.

Wer schon auf dem Ziel-Casting steht, wird übersprungen, der Rest angelegt; der Toast nennt beides. Die Duplikat-Regel ist die der Zeilenbildung aus ADR 0046: `creator_id`, sonst Instagram-Handle, sonst normalisierter Name. Ein Eintrag ohne `creator_id`, dessen Handle zum Creator gehört, zählt als dieser Creator.

Die Auswahl hängt an der Person und überlebt Seitenwechsel, Suche und Sortierung. Nach dem Hinzufügen ist sie leer, der Modus bleibt an.

Das Ziel-Casting in der Leiste ist das Suchfeld (Auto-Suggestion, tippen und filtern; Vorschläge öffnen nach oben), kein natives Dropdown. Markierte Zeilen sind dezent in Gray 100 hinterlegt.

Die Leiste (Zähler, Aktionen, Auswahl aufheben) und die Checkbox-Bindung sind in `src/core/list/SelectionBar.js` gemeinsam; das Casting-Detail nutzt sie für „Kategorie zuweisen“.

## Considered Options

- **Ein Duplikat bricht die ganze Auswahl ab** (Verhalten des Einzel-Drawers): bei 20 markierten Personen blockiert eine einzige alles.
- **Nur grüne Zeilen wählbar**: schließt genau die Personen aus, die noch nicht im System sind, aber auf dem Casting stehen sollen.
- **Rote Zeilen vorher als Creator anlegen**: schreibt Stammdaten ohne Prüfung; ein Casting-Eintrag ohne Creator ist im Casting schon vorgesehen.
- **Persona wählen**: nicht möglich, die Persona-Achse entfällt mit ADR 0049.

## Consequences

- Die Zeilen-Schlüssel (`c:`, `h:`, `n:`) werden im Client aus der Zeile abgeleitet; die RPC `get_casting_bestand` bleibt unverändert.
- Der Schlüssel „Name“ trennt zwei Personen mit demselben Namen und ohne Handle nicht, wie schon in ADR 0046.
