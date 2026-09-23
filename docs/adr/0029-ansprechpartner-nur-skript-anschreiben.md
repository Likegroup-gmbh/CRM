# Ansprechpartner ist Empfänger nur am Skript-Anschreiben

Ein Skript-Anschreiben geht an Creator, Management oder einen Ansprechpartner des Unternehmens, plus der Marke wenn das Skript eine hat. Briefing und Vertrag bleiben bei Creator und Management. Der Ansprechpartner ist ein Datensatz mit ID und Mail, keine freie Adresse. Der Zugang (Link plus Code) bleibt ein anderer Vorgang.

## Considered Options

- **Ansprechpartner an jedem Anschreiben**: ein Empfänger-Modell für alle Dokumenttypen. Briefing und Vertrag bekämen einen Tab, den dort niemand braucht.
- **Nur am Skript**: der Kernel kennt den Typ, der Tab hängt am Skript-Adapter.

## Consequences

- `empfaenger_typ` erlaubt `ansprechpartner` in `mailvorlage` und `anschreiben_log`.
- Der Composer zeigt den Tab nur, wenn der Dokumenttyp ihn anfordert.
