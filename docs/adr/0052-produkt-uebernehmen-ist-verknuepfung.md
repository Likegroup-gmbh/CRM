# Produkt übernehmen ist eine Verknüpfung an die Linie

Dasselbe Produkt wird oft für mehrere Briefings gebraucht (Hochhaus, U-Bahn). „Produkt übernehmen“ hängt die vorhandene Produktzeile an die Linie (`campaign_briefing_produkt`), ohne Kopie und ohne Personas oder Briefing-Daten. `campaign_briefing_produkt` ist damit die Liste der Linie und keine reine Projektion mehr: Persona-Änderungen und Finalisieren schreiben sie nicht mehr um. Das ersetzt von ADR 0021 den Satz, die Briefing-Produkte seien die Union der Persona-Fits.

## Considered Options

- **Kopie pro Linie**: Das Produkt steht mehrfach im Katalog, Änderungen an Beschreibung oder Bildern müssen überall nachgezogen werden. Ein Produkt ist ein Produkt, egal für welches Briefing.
- **Eigene Texte pro Linie**: Doppelte Wahrheit für Inhalt, den das Briefing nicht ändert. Was je Linie anders ist, steht schon an Briefing und Personas.
- **Projektion behalten**: Ein übernommenes Produkt würde beim nächsten Persona-Speichern wieder gelöscht.

## Consequences

- Eine Änderung am Produkt gilt auf allen Linien, die es hat; Löschen des Produkts auch.
- Beim Übernehmen wird nichts von der Herkunftslinie mitgeschrieben: weder Personas noch Skripte noch Briefing. Die Spalten Personas, Briefings und Skripte auf dem Produkte-Tab einer Linie filtern nur die Anzeige. Ein übernommenes Produkt zeigt die Personas (`persona_ids` des Briefings), das Briefing und die Skripte (`briefing_id`) der aktuellen Linie. Das Standardprodukt der Linie (`produktion.produkt_id` bzw. `campaign_briefings.produkt_id`) zeigt seine eigenen Daten, damit es nicht leer wirkt, nur weil das Briefing noch keine Personas hat. Die Produktseite zeigt weiter alles.
- „Von der Linie lösen“ steht im Aktionsmenü der Zeile, nur auf dem Produkte-Tab einer Linie.
- Bestehende Zeilen bleiben liegen, es gibt keine Daten-Migration. Wer ein Produkt nur über den Persona-Fit hatte, behält es, bis es von der Linie gelöst wird.
