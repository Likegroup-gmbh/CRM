# Casting und Konzept sind ein optionales 1:1-Paar; Videoideen bekommen den Creator nur als Casting-Eintrag

Heute teilen Casting und Konzept nur die Kampagne, Creator an der Videoidee kommt aus dem freien CRM-Picker. Beides wird ersetzt: Verknüpfen ist ein eigener Schritt (gleiche Kampagne, gleiches `briefing_id`, inkl. beide leer), danach 1:1. Unlink oder Tausch nur, solange keine Videoidee einen Casting-Eintrag hat. Die Videoidee ist eine Umsetzung (0..1 Eintrag, nur Status Zusage/Gebucht), nicht eine Kernidee mit mehreren Creatorn. Ein Eintrag darf an mehreren Ideen des Konzepts hängen. Der Skript-Generator blockt eine gewählte Videovorlage ohne Eintrag; Freitext-Skript ohne Vorlage bleibt. Erstes Skript friert die Zuordnung; Escape ist die Vorlage am Skript lösen. Absage/Löschen lösen die Zuordnung, außer sie ist eingefroren. Kooperationsvideo bleibt eine spätere Brücke: ohne Eintrag setzt der Video-Link keinen Eintrag; sobald beides existiert, muss der Kooperations-Creator der CRM-Creator des Eintrags sein, sonst blockt die Aktion die den Mismatch erzeugen würde.

## Considered Options

- **1:n Castings am Konzept / n:1 Konzepte an einem Casting**: passt nicht zum bidirektionalen Workflow („das“ Casting). Zwei Listen = zwei Paare.
- **Immer als Paar anlegen**: blockt Idee-zuerst ohne Casting und Creator-zuerst ohne Konzept. Altbestand ist n×n unverknüpft.
- **Zuordnung ist CRM-Creator, Casting nur Filter**: driftet, sobald die Person von der Liste fliegt. Casting-Eintrag ohne `creator_id` wäre nicht zuordenbar.
- **Shortlist an der Videoidee / Kernidee mit n Umsetzungen**: zweites Casting an der Idee, oder ein Objekt das es nicht gibt. Master-Prompt („eine Idee, mehrere Creator-Umsetzungen“) wird an die Paarung angepasst, nicht das Modell an den Prompt.
- **Stille Migration von `creator_id`/`creator_name`**: Trefferquote schlecht, Altbestand bleibt Anzeige bis Neu-Zuordnung aus dem Casting.

## Consequences

- Creator-zuerst: am Eintrag (Paar + Zusage/Gebucht) „Videoidee anlegen“ erzeugt die Idee im Konzept schon zugeordnet.
- Status-Regression (Gebucht → In Verhandlung) lässt die Zuordnung stehen; Skript-Gate prüft Existenz, nicht den Live-Status.
- Altbestand ohne Paar bleibt gültig. Ohne Paar keine Zuordnung und damit keine Skript-Vorlage aus diesen Ideen.
