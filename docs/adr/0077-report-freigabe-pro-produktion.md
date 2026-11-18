# 0077 Report-Freigabe pro Produktion, die Kampagne setzt sich daraus zusammen

Die Auswertung hat drei Sichten: eine Linie, alle Linien einer Produktion und die ganze Kampagne. Kunde und Gast sehen nie Live-Daten, sondern einen eingefrorenen Stand. Die Spec des Auswertungs-Tabs sieht je Ebene eine eigene Freigabe vor.

## Entscheidung

- **Eingefroren wird pro Produktion:** Die Report-Freigabe enthält die Kennzahlen, die Posts mit Werten über alle Linien und die Zusammenfassung der Produktion.
- **Linie filtert:** Die Linien-Sicht zeigt den freigegebenen Stand ihrer Produktion, gefiltert auf die Linie. Eine eigene Freigabe hat sie nicht.
- **Kampagne setzt sich zusammen:** Die Kampagnen-Sicht rechnet über die letzten Report-Freigaben ihrer Produktionen. Eigen ist nur die Zusammenfassung der Kampagne; sie wird separat freigegeben.

## Verworfen

- **Getrennte Freigabe je Ebene.** Wird eine Produktion neu freigegeben, die Kampagne aber nicht, sieht der Kunde in der Kampagne 4,6 Mio. Aufrufe und in der Summe der Produktionen 4,2 Mio.
- **Eine Freigabe für die ganze Kampagne.** Wer Produktion A freigibt, schiebt damit auch den halbfertigen Stand von Produktion B zum Kunden.
- **Freigabe je Linie.** Drei Stände für eine Produktion, und die Produktions-Sicht hätte keinen eindeutigen.

## Folgen

- Eine Produktion ohne Report-Freigabe fehlt in der Kampagnen-Sicht des Kunden. Die Kampagnen-Sicht nennt das („2 von 3 Produktionen freigegeben“).
- Die Kennzahlen der Kampagne entstehen aus denselben Rechenfunktionen wie die der Produktion, nur über mehr Posts.
