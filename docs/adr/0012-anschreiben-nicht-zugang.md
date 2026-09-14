# Anschreiben ist nicht Zugang

Ein Briefing geht per E-Mail mit PDF-Anhang an Creator oder Management raus (Anschreiben).
Das ist ein anderer Vorgang als der bestehende Zugang (Gast-Link + Code auf `list_shares`),
und beide bleiben getrennt: das Anschreiben bekommt eigene Bausteine (Empfänger-Composer,
Anschreiben-Drawer, Mailvorlagen, Versandprotokoll, Resend-Helper) statt den ShareListDialog
oder `list_shares` um PDF-Mails zu erweitern.

## Considered Options

- **Zugang um Anhang-Mail erweitern**: ein Dialog für beides. Verwässert beide Modelle —
  der Zugang ist anonym (Label + Code, kein Empfänger-Konto), das Anschreiben braucht
  adressierbare Empfänger mit ID und Mail, Vorlagen und ein Protokoll pro Empfänger.
- **Anschreiben als eigenes Primitiv**: getrennte Daten (`mailvorlage`, `anschreiben_log`),
  eigener Drawer, eigener Send-Pfad. Der Zugang bleibt unverändert.

## Consequences

- Empfänger sind nur Creator (`creator.mail`) oder Management (`management.email`) mit ID —
  keine Casting-Einträge ohne CRM, keine freien Adressen ohne Datensatz.
- `list_shares` bekommt kein `entity_type: briefing` und keine Anhänge.
- Das Versandprotokoll (`anschreiben_log`) ist pro Empfänger, nicht pro Zugang.
