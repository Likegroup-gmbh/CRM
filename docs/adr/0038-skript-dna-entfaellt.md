# 0038 Skript-DNA entfällt, das Master-Regelwerk ist die einzige Regelquelle

Skripte entstehen nur noch aus dem Master-Dokument (`skript_master`, Basis plus Bereich). Eine zweite Regelschicht (Skript-DNA nach Global, Branche, Zielgruppe, Marke) widersprach dem Master und kostete Kontext in jedem Aufruf.

## Entscheidung

- Generator, Edit-Chat und Rückfragen laden und formatieren keine DNA mehr. `loadContext` liefert nur noch Branche und Master.
- Die Leiter bei Konflikten ist: 1 Don'ts und belegte Fakten, 2 ausdrückliche Anweisung (schlägt das Master-Regelwerk bei Ton und Geschichte), 3 Master-Regelwerk für Aufbau und Bereichssystem, 4 Dos als Soll. Das ersetzt die DNA-Stufe aus ADR 0035.
- UI: Route, Adapter, Listen-Link, Breadcrumb und Service-Methoden der DNA sind weg. `/skripte/dna` leitet auf `/skripte/master` um.
- Der Editor zeigt keine Zeile „Skript-DNA“ mehr, der Generator-Payload trägt kein `mit_dna`.

## Bewusst nicht angefasst

- Tabelle `skript_dna` und Spalte `skripte.mit_dna` bleiben in der DB (Daten, Rückweg). `mit_dna` ist `NOT NULL DEFAULT true`, neue Skripte schreiben es nicht.
- Löscht man eine Persona, geht eine Zielgruppen-DNA weiterhin per Cascade mit.
- Wer die Tabelle später entfernt, braucht eine eigene Migration.
