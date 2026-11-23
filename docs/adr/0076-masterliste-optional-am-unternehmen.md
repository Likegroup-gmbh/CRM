# 0076 Masterliste: optional einem Unternehmen zugeordnet, Ordner je Unternehmen

Beim Aufbau der Masterliste war entschieden: ein gemeinsamer Pool der Agentur, kein Unternehmen, keine Marke, eine flache Liste unter Creatordaten. In der Praxis pflegen die Teams Listen für bestimmte Kunden und suchen sie dort, wo auch die Castings liegen: im Ordner des Unternehmens. Entschieden: `creator_list.unternehmen_id` ist optional. Die Übersicht zeigt wie die Castings einen Ordner je Unternehmen (Liste oder Grid), dazu „Ohne Unternehmen“ für Listen der ganzen Agentur.

## Entscheidung

- **Höchstens ein Unternehmen, freiwillig.** Ohne Zuordnung bleibt die Liste ein Pool für alle Kunden. Gewählt wird im Drawer „Neue Masterliste“ bzw. „Bearbeiten“. Wer im Ordner eines Unternehmens anlegt, hat es vorbelegt.
- **Keine Marken-Ebene.** Eine Liste bedient alle Marken eines Unternehmens. Unter dem Unternehmen liegen die Listen direkt.
- **Suche über alle Ordner.** Auf der obersten Ebene hebt eine Suche die Ordner auf und zeigt die Treffer mit Unternehmen. Im Ordner sucht sie nur dort.
- **Ordner in der URL** (`?unternehmen=<id>&unternehmen_name=…`, `?unternehmen=ohne`). Die Breadcrumb führt von der Liste zurück in ihren Ordner.
- **`on delete set null`.** Wird das Unternehmen gelöscht, rutscht die Liste nach „Ohne Unternehmen“. Die Creator bleiben auf ihr.

## Verworfen

- **Mehrere Unternehmen je Liste.** Eine Liste für drei Kunden ist der Pool. Eine n:m-Tabelle hätte Ordner, Zähler und Formular verdoppelt.
- **Unternehmen und Marke wie beim Casting.** Die Marke wäre zu eng, dieselbe Crew gilt oft für mehrere Marken.
- **Masterlisten in den Casting-Ordnern oder im Unternehmen-Detail.** Die Masterliste bleibt eine eigene Seite unter Creatordaten. Gewünscht war dort dieselbe Ordneransicht.

## Folgen

- Ein Unternehmen, das der Nutzer nicht lesen darf (Test-Unternehmen für Nicht-Admins), erscheint als eigener Ordner „Unternehmen“ und nicht unter „Ohne Unternehmen“.
- Kunden sehen weiterhin keine Masterlisten. Die Zuordnung gibt ihnen keinen Zugriff.
