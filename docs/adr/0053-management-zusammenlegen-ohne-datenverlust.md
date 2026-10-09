# Management zusammenlegen ohne Datenverlust

Mitarbeiter haben dieselbe Agentur mehrfach angelegt, und der Duplikat-Check kannte Management nicht. Namensgleich (Kernname ohne Rechtsform, Groß/Klein, Leerzeichen, Satzzeichen) sperrt das Anlegen und legt Gruppen für das Zusammenlegen fest. Zusammengelegt wird jede Namensgruppe, aber verlustfrei: Die Spalte behält den Wert des bleibenden Datensatzes, jeder abweichende Wert (zweite Mail, zweite Adresse) steht als Weitere Angabe in der Notiz. Nur zwei verschiedene Rechtsformen (GmbH gegen AG) halten eine Gruppe zurück, weil das meist zwei Rechtsträger sind. Die Gruppenliste erschien vor dem Schreiben im Chat statt in einer eigenen Seite, weil die Bereinigung einmalig ist.

## Considered Options

- **Gruppe bei jedem Feldunterschied liegen lassen**: Anfangsregel. Von 17 Gruppen wären 13 geblieben, meist wegen Schreibweisen (Straße/Strasse, Köln/Cologne, Straße mit Hausnummer). Die Handarbeit stand in keinem Verhältnis.
- **Ein Wert gewinnt, der andere verschwindet**: Bei Adresse oder Mail wäre die falsche Wahl still und nicht mehr zu sehen.
- **Tippfehler mitziehen**: „Compny XY“ würde mitgelegt. Zwei Agenturen mit ähnlichem Namen gibt es wirklich; die Warnung beim Anlegen reicht dafür, das Zusammenlegen bleibt eng.
- **Adresse feldweise mischen**: Bei zwei echten Adressen entstünde eine Mischadresse (Straße aus Köln, Stadt aus Monheim). Die Adresse wird deshalb als Block behandelt: die erste bleibt, die andere steht in der Notiz.

## Consequences

- Ein Name mit Rechtsform ersetzt den ohne, wenn die Gruppe genau eine Rechtsform hat.
- Der Check beim Anlegen ist eine Einbindung (`bindDuplicateCheck`), die Creator, Marke, Unternehmen und Management teilen. Neue Entities tragen sich dort mit Feldern, Check und Route ein.
- Verträge, die auf ein entferntes Management zeigten, zeigen danach auf den bleibenden Datensatz, und damit auf dessen Adresse. Der Trigger `sync_vertrag_status` leitet den Status beim Update aus den Dateien ab; Verträge mit unterschriebener Datei, deren Status noch `erstellt` war, stehen danach auf `unterschrieben`.
- Der Stand vor dem Zusammenlegen liegt in `management_merge_backup_20261009` (nur Service-Zugriff, RLS an).
