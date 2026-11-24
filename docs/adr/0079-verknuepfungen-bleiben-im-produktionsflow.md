# 0079 Verknüpfungen bleiben im Produktionsflow

ADR 0074 holte den Skript-Editor in den Tab Skripte. Alle anderen Verknüpfungen in den Tabs der Produktion (Budget bis Auswertung) führten weiter auf die Einzelseiten: eine Briefing-Pill im Tab Produkte öffnete `/briefing/:id`, eine Skript-Pill in Produkte oder Personas baute die ganze Produktion zweimal neu auf (Seite verlassen, dann zurückgeleitet), Produkt und Persona hatten im Flow gar keine Ansicht. Jetzt bleibt jede Verknüpfung, die einen Datensatz der Produktion zeigt, in der Produktion und wechselt nur Tab, Linie und Ansicht.

## Entscheidung

- **Eine Übersetzung im Router statt Code je Link.** Die Produktion bedient über `handleRouteInPlace` zwei Arten von Adressen:
  - ihre eigenen (`/produktion/:id?tab=…&linie=…` plus der Parameter des Tabs);
  - Entity-Adressen, die irgendwo im Flow gerendert werden (`/briefing/:id`, `/produkt/:id`, `/(marke|unternehmen)/:x/produkt?produkt=`, dasselbe für Personas, `/skripte/:id`, `/konzepte/:id`, `/castings/:id`).

  Eine Entity-Adresse wird übersetzt, wenn der Datensatz zu einer Linie dieser Produktion gehört. Pills, Tabellen und Listen bleiben unverändert. Welche Entity in welchen Tab gehört, steht an einer Stelle (`produktionFlowZiele.js`). Ein neues Ziel kommt nur dort hinzu.
- **Linie des Ziels.** Briefing, Produkt und Persona prüft die Produktion an ihren geladenen Linien. Skripte, Konzepte, Casting-Listen und unbekannte Produkte oder Personas fragt sie ab (`briefing_id`, Junction, `persona_ids`), und die Abfrage läuft durch die RLS. Passen mehrere Linien, gilt in dieser Reihenfolge: der Hinweis `?briefing=`, die aktive Linie, die erste Linie. Gehört der Datensatz nicht zur Produktion, navigiert der Router wie bisher zur Einzelseite. Ein Klick während einer laufenden Abfrage verwirft deren Ergebnis.
- **Nur Ansichten.** Briefing, Produkt, Persona, Skript, Konzept und Casting öffnen im Flow. Bearbeiten- und Anlegen-Seiten (Briefing bearbeiten, Vertrag-Editor, Kooperation bearbeiten, Produkt und Persona anlegen) bleiben eigenständig.
- **Was offen ist, merkt der Tab.** Je Tab gibt es einen URL-Parameter (`skript`, `produkt`, `persona`, `konzept`, `casting`). Der Zustand bleibt beim Tab-Wechsel erhalten, steht aber nur im aktiven Tab in der URL. Bei Skript, Produkt und Persona ersetzt die Ansicht die Liste. Bei Konzept und Casting ist der Parameter die gewählte Liste im Dropdown.
- **Produkt und Persona im Tab.** Das Formular läuft wie auf `/produkt/:id` bzw. `/persona/:id`, nur im Pane. Rechts in der Tab-Zeile sitzt eine Wahl wie die Skriptwahl: „Alle Produkte“ bzw. „Alle Personas“ und darunter die Einträge der Linie. Die Breadcrumb hängt den Namen an. Speichern, Abbrechen und Löschen kehren zur Liste zurück.
- **History.** Ein Klick legt einen Eintrag an, Zurück und Vor laufen ohne Neuaufbau. Der Wechsel über die Wahl ersetzt den Eintrag. Zurück auf eine echte Einzelseite (vor der Produktion besucht) bleibt die Einzelseite.
- **Neuer Tab.** Cmd-, Strg-, Shift- und Mittelklick auf eine Pill öffnen den href nativ im Browser.

## Verworfen

- **hrefs je Tabelle auf Flow-Adressen umschreiben.** Dafür hätte jede Tabelle wissen müssen, ob sie gerade in einer Produktion steht. Neue Tabellen hätten das wieder vergessen, und Links aus Listen (ProduktList, PersonaList) wären außen vor geblieben.
- **Edit-Seiten in den Flow holen.** Das Briefing hat dort schon seinen eigenen Tab. Vertrag- und Kooperations-Editor brauchen die volle Breite und haben eigene Speicher- und Verlassen-Logik.
- **Produkt und Persona als Drawer über der Liste.** Das Worksheet mit Liky-Spalte passt nicht in einen Drawer, und Zurück im Browser hätte keinen Zustand gehabt.

## Folgen

- Gäste (`guestShare`) und Nutzer ohne Recht auf den Ziel-Tab bekommen weiter die Einzelseite.
- Der Soft-Refresh der Produktion wartet, solange eine Ansicht offen ist (vorher nur beim Skript).
- Der Linienwechsel schließt alles Offene. Jeder Tab zeigt danach die Liste der neuen Linie.
- Produkt- und Personaformular haben eine Einbettung (`core/doc/docEinbettung.js`): Sie schreiben in einen Host statt in `window.content`, setzen keine Headline und schließen per Callback.
