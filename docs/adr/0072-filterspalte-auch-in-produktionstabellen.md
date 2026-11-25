# 0072 Filterspalte auch in den Tabellen der Produktion

Löst ADR 0018 ab. Die linke Filterspalte der Creator-Datenbank gibt es jetzt auch in den drei Tabellen einer Produktion: Casting, Konzept (Videoideen) und Kooperationen. Spalte, Chips und Sortierauswahl liegen in einem gemeinsamen Kernmodul (`src/core/filterColumn/`); jede Tabelle liefert nur ihre Filter und Sortierungen.

## Entscheidung

- **Eingeklappt.** In der Produktion startet die Spalte zu, weil die Tabellen breit sind und fixierte Spalten haben. Der Button „Filter“ neben der Suche zeigt die Zahl der aktiven Filter, die Chips stehen über der Tabelle. Der Zustand (offen oder zu) bleibt je Tabelle gespeichert.
- **Im Browser gefiltert.** Die drei Tabellen halten ihre Zeilen schon komplett im Speicher; Filter und Sortierung laufen ohne neue Abfrage. Die Creator-Datenbank filtert weiter auf dem Server.
- **Auswahl in der URL**, mit Präfix je Tabelle (`casting.`, `konzept.`, `koop.`), damit sie nicht mit `tab`, Linie oder Konzept-Parametern kollidiert.
- **Sortieren speichert nie.** Casting und Konzept sortieren standardmäßig „Manuell“. Jede andere Sortierung ordnet nur die Ansicht (innerhalb der Kategorien) und sperrt solange das Ziehen. Ziehen unter aktivem Filter lässt ausgeblendete Zeilen an ihrem Platz. Kooperationen haben keine manuelle Reihenfolge und sortieren wie bisher, Standard „Neueste zuerst“.
- **Reiter und Suche bleiben** vorgeschaltet. Die Menüeinträge „Status filtern“ (Casting, Kooperationen), „Tags filtern“ und „Sortierung“ (Kooperationen) sind in die Spalte gewandert.
- **Kunden** sehen nur Filter auf Spalten, die sie auch sehen; Preise, Matching, Persona und Skript-Status bleiben dem Team.
- **Eigene Spalten** der Typen Dropdown, Ja/Nein, Zahl und Datum erscheinen automatisch in der Gruppe „Eigene Spalten“. Text, Link und Upload bleiben der Suche überlassen. Bei Video-Spalten einer Kooperation reicht ein passendes Video.

## Verworfen

- **Spalte offen wie in der Creator-Datenbank.** Sie nähme den breiten Tabellen dauerhaft Platz weg.
- **Sortierung als neue manuelle Reihenfolge speichern.** Ein Klick würde die gepflegte Reihenfolge aller Nutzer überschreiben.

## Folgen

- Die Spalte der Kooperationen hängt weiter an `canFeature('kampagneTableFilter')`.
- Die Summary-Karten rechnen weiter nur nach Tags (Produktentscheidung), nicht nach den übrigen Filtern der Spalte.
- Die Kampagnen-Übersicht und die Ordneransichten bekommen die Spalte nicht.
