# 0074 Skript-Editor läuft in der Produktion

Im Produktionsflow (ADR 0045) listet der Tab Skripte die Skripte der Linie. Ein Klick öffnete bisher das eigenständige Scripting-Tool unter `/skripte/:id`; Tab-Leiste und Linie waren weg, und wer zwischendurch in Verträge oder Briefing schauen wollte, musste zurück navigieren. Der Editor läuft deshalb im Tab Skripte der Produktion selbst.

## Entscheidung

- **Adresse:** `/produktion/:id?tab=skripte&linie=…&skript=…`. Ohne `skript` zeigt der Tab die Tabelle der Linie, mit `skript` den Editor. Öffnen, Schließen und Zurück laufen ohne Neuaufbau der Seite: der Router fragt zuerst das aktive Modul (`handleRouteInPlace`), die Produktion bedient Adressen ihres eigenen Skripte-Tabs in derselben Linie selbst.
- **`/skripte/:id` leitet um.** Hat das Skript eine Linie und sieht der Nutzer Produktion und Skripte-Tab, landet jeder Weg dorthin in der Produktion: Skripte-Navigation, Deep-Links, Links aus anderen Tabs, „Skript anlegen“. Die Weiterleitung ersetzt den History-Eintrag und kürzt den Klickpfad (ADR 0042) bis zur Produktion, damit die Produktion nicht doppelt in der Breadcrumb steht. Das eigenständige Tool bleibt für Gäste, Teilen-Links und Skripte ohne Kampagne oder Linie.
- **Einstieg bleibt die Tabelle.** Ein Klick auf den Titel öffnet den Editor im Tab. Zurück im Browser, ein erneuter Klick auf den Tab Skripte oder „Alle Skripte“ in der Skriptwahl führen zur Tabelle.
- **Keine Listenspalte.** Statt der linken Skriptliste sitzt rechts in der Tab-Zeile ein Dropdown wie bei Casting und Konzepten: je Skript Nummer, Titel, Creator und Status, darüber „Alle Skripte“. „Neues Skript“ entfällt im Editor, angelegt wird über „Skript anlegen“ der Produktion mit der aktiven Linie.
- **Aufgeräumter Dokumentkopf.** Sichtbar bleiben Version, Status, Creator- und Video-Chip und „Senden“. Das Team ändert den Status dort über dieselbe Auswahl wie in der Skripte-Tabelle; jeder Status außer „Freigegeben“ nimmt den Haken „Skript freigegeben“ an den Videos raus. Kunden sehen weiter nur das Freigegeben-Badge, ein Gast mit Bearbeiten-Recht „Freigeben“ (ADR 0030). PDF, Link kopieren, „Skripte dieses Creators teilen“, „Creator tauschen“ und Löschen liegen im „…“-Menü. Das gilt auch im eigenständigen Tool.
- **Kopf der Produktion:** Solange ein Skript offen ist, entfällt die Titelzeile. „Skript anlegen“ und die Aktionen der Produktion rücken rechts in die Tab-Zeile, das Paket-Teilen gibt es nur in der Tabelle.
- **Breadcrumb:** Klickpfad nach ADR 0042, das Skript hängt als letztes Glied an. Der Crumb der Produktion führt zur Tabelle.
- **Linie wechseln** schließt den Editor und zeigt die Tabelle der neuen Linie.
- **Tab wechseln und zurück** öffnet wieder dasselbe Skript. Der Editor wird beim Verlassen abgebaut, offene Eingaben vorher gespeichert, und beim Zurückkommen neu geladen.

## Verworfen

- **Editor als eigene Seite mit nachgebauter Tab-Leiste.** Zwei Stellen, die Tabs, Linien-Switch und Berechtigungen kennen müssten, und jeder Tab-Wechsel wäre ein Seitenwechsel.
- **Nur Links aus dem Skripte-Tab umleiten.** Wer über die Skripte-Navigation oder einen geteilten Link kommt, landete wieder ohne Produktion im Tool, und dasselbe Skript hätte zwei Ansichten mit unterschiedlicher Navigation.
- **Listenspalte im Tab behalten.** Neben Tab-Leiste, Dokument und Feedback bleibt dem Skript zu wenig Breite; die Skriptwahl in der Tab-Zeile kennen die Nutzer aus Casting und Konzepten.
- **Editor beim Tab-Wechsel im Hintergrund weiterlaufen lassen.** Realtime, Chat und Feedback liefen unsichtbar weiter und hielten ihre Listener; der Neuaufbau beim Zurückkommen ist kurz.

## Folgen

- Wer die Produktion oder den Skripte-Tab nicht sehen darf, bekommt weiter das eigenständige Tool. Die Prüfung läuft über die Berechtigung des Tabs und darüber, ob die RLS die Produktion liefert.
- Ein Soft-Refresh der Produktion wartet, solange ein Skript offen ist; der Editor hält seine Daten selbst über Realtime aktuell.
- Liky öffnet wie bisher als Bubble über dem Dokument, auch in der Produktion.
