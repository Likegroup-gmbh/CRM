# Produkt-Startrun schlägt genau eine neue, breite Persona vor

Liky am Produkt erzeugt im Startrun genau eine Persona: den breitesten tragfähigen Typ, immer `typ=neu`. Auto-Match auf den Unternehmens-Pool entfällt, obwohl `produkt_persona_vorschlag` Matches kann – Wiederverwenden bleibt manuell über „Bestehende hinzufügen“. Weitere breite Typen kommen nur per bewusstem +1, enge Typen über den Personas-Tab.

## Considered Options

- **Auto-Match der breitesten bestehenden**: spart Duplikate, würde aber Szenen-Personas als „die eine“ nehmen, sobald der Fit enger ist.
- **Fill-to-6 wie bisher**: deckt Nischen ab, die die meisten Kunden nicht brauchen.

## Consequences

- Zwei Produkte im selben Unternehmen können zwei ähnliche Typen anlegen. Reuse ist bewusst ein manueller Schritt.
- `modus=alle` (Auffüllen bis 6) gibt es nicht mehr.
