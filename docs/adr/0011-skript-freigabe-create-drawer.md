# Skripte entstehen nur aus freigegebenen Videoideen; Create sitzt im Drawer

Der alte Generator unter `/skripte/new` hat Unternehmen, Marke, Kampagne, Briefing, Bereich und Video-Idee nochmal abgefragt, obwohl das alles schon an Konzept, Casting und Briefing hängt. Freitext ohne Vorlage bleibt tot: ein Skript braucht eine Videoidee mit Skript-Freigabe (Casting-Eintrag + nicht „Nicht umsetzen“). „Neues Skript“ öffnet denselben rechten Create-Drawer wie Konzept und Casting; Submit legt den Stub an und startet Likys Rückfragen im Editor.

`strategie_items.skript_freigabe` ist das Gate für Neuanlage, nicht `kooperation_videos.skript_freigegeben` (das ist die Freigabe des fertigen Skripts am Video). Altbestand ist bewusst nicht freigegeben.

Der Drawer fragt nur Unternehmen, Konzept und Videoidee. Marke, Kampagne, Briefing, Bereich, Branche und Persona kommen aus Videoidee → Konzept → Casting-Eintrag. Produkt nur bei genau einem accepted Fit der Persona, sonst leer. Skript-DNA wird nicht gewählt (`mit_dna: false`) – Generate läuft über das Master-Regelwerk (`basis` + Briefing-Bereich).

## Considered Options

- **Kein neues Flag, nur Casting-Eintrag + nicht_umsetzen**: wäre implizit und würde jede zugeordnete Idee in den Picker spülen. Die ausdrückliche Freigabe im Konzept ist der Prozessschritt.
- **Freitext-Generator als Ausnahme behalten**: genau die Doppelpflege, die raus sollte.
- **Rückfragen überspringen („Direkt generieren“)**: der Editor-Chat bleibt für Iterationen; der Pflichtschritt vor dem ersten Entwurf bleibt.
