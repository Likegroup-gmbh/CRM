# Produktion sitzt unter der Kampagne, der Topf bleibt oben

Ein neuer Auftrag legt genau eine Kampagne an. Die Kampagne hält Netto, Kampagnenarten und das Video- und Creator-Soll. Produktionen darunter sind die Läufe pro Produkt: jede entsteht mit einem Briefing und trägt Casting, Konzept, Skripte, Verträge, Kooperationen, Videos und Auswertung. Das Briefing bleibt die Ablage an Unternehmen und Marke und gehört operativ genau dieser Produktion.

Der Wizard splittet das Auftrags-Netto nicht mehr auf mehrere Kampagnen. Bestand mit mehreren Kampagnen bleibt unverändert, jede bekommen eine Produktion, nichts wird zusammengelegt. `kampagne_id` an den Kindern bleibt stehen und zeigt immer auf die Kampagne der Produktion, damit Topf, Soll, RLS und Dropbox nicht umziehen. Gefiltert wird über `produktion_id`.

## Considered Options

- **Weiter N Kampagnen mit gesplittetem Volumen**: jede Linie hätte einen eigenen Topf. Der Auftrag ist aber ein Topf, die Linien zehren davon.
- **Kooperation in Produktion umbenennen**: die Kooperation ist die Creator-Buchung. Die neue Ebene liegt darüber.
- **Briefing nur an der Kampagne, ohne Firmenablage**: die Liste aller Briefings eines Unternehmens würde auseinanderfallen.
