# Alternative gesprochene Hooks sitzen am Skript, nicht als Extra-Versionen

Hook 1–3 sind Spoken-only-Spalten am selben Skript; intern tauschbar mit dem Haupthook. Extra-Versionen v2/v3 nur für Hook-Alternativen sind raus – Versionen bleiben Edit-History. Letztes Mal ohne diese Entscheidung war die Tabelle still weg.

## Considered Options

- **B/C als volle Versions-Snapshots**: versteckt den Picker im Versionsmenü und mischt Alternativen mit Edit-History.
- **Gesprochen plus Visual in der Extra-Tabelle**: Scripter brauchen in diesem Step nur Sprechertext.

## Consequences

- Persistenz in `hook_variante_1/2/3` auf `skripte` und `skript_versionen`. Inline-Edit, Formatierung und Liky laufen ohne Sonderweg.
- Kunden-RPC und Share bleiben ohne die Felder – Extra-Tabelle nur intern.
- Swap legt eine Version an (`Hook übertragen · Hook 1`). Visual des Haupthooks bleibt.
