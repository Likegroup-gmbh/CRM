# Zwei Periodisierungen: Marge nach Auftrag, Buchhaltung nach Rechnungsdatum

„Umsatz minus Fremdkosten im Maerz" hat zwei legitime Lesarten, und der Fehler waere, sie in eine Zahl zu pressen. Die Margenansicht ordnet Umsatz und die von ihm ausgeloesten Fremdkosten gemeinsam dem Monat der Kundenrechnung zu; der Auftrag ist der Anker. Die Buchhaltungsansicht ordnet jeden Betrag dem Monat seines eigenen Rechnungsdatums zu — kundenseitig `rechnung_gestellt_am`, creatorseitig `gestellt_am`.

Ausloeser war eine Messung des zeitlichen Versatzes zwischen Kundenrechnung und den zugehoerigen Creatorrechnungen: nur 16,5 % des Einkaufsvolumens trifft im selben Monat ein, 38,4 % einen Monat spaeter, 26,3 % nach zwei bis drei Monaten und 12,7 % noch spaeter. Eine reine Rechnungsdatum-Betrachtung misst damit nicht die Marge, sondern das Wachstumstempo: wachsende Monate wirken hochprofitabel, weil die Kosten noch fehlen, ruhige Monate brechen ein, weil die Kosten der Vormonate eintreffen.

## Considered Options

- **Nur Rechnungsdatum**: stabil und belegbar, aber die Monatsmarge je Leistungsbereich bleibt strukturell irrefuehrend — genau die Fehldeutung, die ein Investoren-Update nicht produzieren darf.
- **Nur Auftragszuordnung**: die Marge stimmt, aber die Buchhaltung verliert die Sicht darauf, was tatsaechlich in einem Monat durch die Buecher gegangen ist.
- **Leistungszeitraum fuer beides**: wirtschaftlich naeher an der Wahrheit, aber nicht belegbar und bei laufenden Kampagnen nicht eindeutig abgrenzbar.
- **Beide Ansichten nebeneinander** (gewaehlt).

## Consequences

- Ein abgeschlossener Monat aendert sich in der Margenansicht rueckwirkend, sobald eine spaete Creatorrechnung eintrifft. Das ist keine Schwaeche, sondern eine Eigenschaft des Nachlaufs, und wird als Stand-Datum ausgewiesen statt kaschiert.
- Hat ein Auftrag mehrere Kundenrechnungen (Teilrechnungen), folgen die Fremdkosten dem Umsatz anteilig ueber dessen Rechnungsmonate: bei 50/50-Raten traegt jeder Monat die Haelfte der Kosten. Alles andere wuerde die gesamten Kosten in den erste Monat legen und die Monatsmarge genau bei den Raten-Auftraegen kippen lassen.
- Weil sich berichtete Zahlen dadurch spaeter aendern koennen, wird zu jedem Investorenupdate ein Berichtsstand gespeichert. Die Ansicht rechnet immer live; der Snapshot dient nur dazu, eine einmal gemeldete Zahl spaeter noch begruenden zu koennen. Monate einzufrieren waere die Alternative gewesen, haette aber Nachzuegler in falsche Monate verschoben und damit die Zuordnungslogik ausgehebelt, die dieser ADR gerade begruendet.
- Die beiden Ansichten zeigen fuer denselben Monat unterschiedliche Zahlen. Sie muessen deshalb sichtbar getrennt und benannt sein; eine Ansicht ohne Bezeichnung waere schlimmer als gar keine.
- Noch nicht fakturierte Fremdkosten fehlen in beiden Ansichten in der Hauptzahl und stehen als eigene Zeile daneben. Zum Zeitpunkt der Entscheidung waren das 91.878,95 €, davon 81.223 € aus einer einzigen Kampagne mit 50/50-Zahlungszielen.
- Auftraege ohne Kampagnenart-Block bekommen den Leistungsbereich „Nicht zugeordnet" statt einer geratenen Zuordnung. Betroffen waren 39 von 157 Auftraegen mit zusammen 2.232.163 € Umsatz. Die Summe der Bereiche ergibt damit immer das Gesamt.
