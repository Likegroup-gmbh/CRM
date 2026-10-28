# Konzept-Einladung hängt am Casting-Eintrag

Creator reichen ihre Konzeptideen über ein Formular ein (**Creator Concept Sheet**), nach derselben Kette wie Briefing und Produkt (ADR 0055): Einladung, Einreichung (nur Team), Prüfen, Anlegen. Die Einladung der Art `konzept` hängt an genau einem **Casting-Eintrag** (`einladung.creator_auswahl_item_id`, ein Link und ein 6-stelliger Code je Person) und zusätzlich an der Linie (`briefing_id`). Eine Einreichung wird genau eine Videoidee im Konzept der Linie. Der Name der Person kommt serverseitig aus dem Eintrag, nicht aus dem Formular.

Das Creator-Sheet bleibt als Block an der Idee erhalten: Es liegt unverändert in `einreichung.payload` (nur Team lesbar, per Trigger unveränderlich) und hängt über `strategie_items.einreichung_id` an der Videoidee. Titel, Idee, Hook und Ablauf wandern beim Anlegen in die Felder der Videoidee, der Rest (Marken-Integration, Beispiele, alternative Idee) bleibt nur im Block.

## Considered Options

- **Ein allgemeiner Link je Linie, Zuordnung zum Creator beim Prüfen**: Der Absender tippt seinen Namen selbst, das Team ordnet ihn zu. Fehlerhaft und spoofbar, und der Eintrag (und damit die „getaggt“-Zuordnung) entsteht erst durch Handarbeit.
- **Nur Mapping in die bestehenden Felder, kein Block**: Marken-Integration, Beispiel-Links und alternative Idee gingen verloren, obwohl sie fürs Briefing der Umsetzung wichtig sind.
- **Block als Spalte an `strategie_items`**: Kunden lesen `strategie_items`; der Block müsste clientseitig versteckt werden, wie heute `umsetzungsvorgabe`. Die Staff-only-RLS auf `einreichung` schützt dagegen serverseitig.

## Consequences

- Die Einladung ist nur nutzbar, solange der Eintrag existiert und nicht abgesagt, abgelehnt oder unter „Nicht umsetzen“ steht (`konzeptGesperrt` in der Edge Function, geprüft bei jedem öffentlichen Aufruf). Das fängt Creator-Tausch und Löschen ab, ohne Trigger; `ON DELETE SET NULL` lässt die Einreichung bestehen, im Eingang steht dann „Eintrag nicht mehr im Casting“.
- Je Eintrag gibt es höchstens eine aktive Einladung (Unique-Index); eine neue widerruft die alte. Mehrere Ideen über denselben Link sind möglich („Weitere Idee einreichen“), jede ist eine eigene Einreichung.
- Anlegen schreibt direkt per Insert und umgeht damit das Zuordnungs-Gate der Tabelle (Kunden-Prio plus Zusage): Wer eine Idee eingereicht hat, ist gesetzt. Die Skript-Freigabe prüft weiter selbst.
- Die Mail geht an `creator.mail`, sonst an das aktive Management; ohne beides zeigt der Drawer Link und Code zum Weitergeben.
- Ist der Eintrag nicht mehr im Casting, wählt das Team im Review einen anderen Eintrag oder legt ohne Zuordnung an.
- Der Eingang erscheint auf dem Konzepte-Tab der Produktion (Zähler am Tab) in der eigenen Ansicht „Creator-Ideen“, als Tabelle wie die übrigen Listen. Ein Switch (Konzept | Creator-Ideen) in der Tab-Zeile trennt sie von den Videoideen und Mitarbeiter-Vorschlägen des Konzepts. Prüfen öffnet den Videoidee-Drawer statt eines eigenen Screens.
