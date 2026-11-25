# Vertrag-Status sitzt am Vertrag, Anschreiben bleibt ein Kernel

Der Lebenszyklus des PDFs (Entwurf, Erstellt, Gesendet, Unterschrieben, Verzögert, Abgelehnt)
wird als `vertraege.status` gespeichert, nicht aus Dateien abgeleitet und nicht mit dem
Kooperation-Status (`kampagne_status`) vermischt. Ableiten reicht nicht mehr, sobald
„Gesendet“ existiert: das PDF bleibt. Open-Tracking (Resend `email.opened`) lassen wir
weg — Apple Mail Privacy Protection und geblockte Pixel würden den Status belügen.

Anschreiben bleibt ein Kernel mit Typ-Adaptern (Briefing, Vertrag). Kein zweites Mail-Modul,
kein Drawer-Klon pro Seite. Mailvorlagen haben einen Standard pro `dokument_typ`.

Niemand setzt den Status manuell. System schreibt Entwurf/Erstellt/Gesendet/Unterschrieben;
Verzögert folgt 30 Tage nach `gesendet_am` ohne unterschriebenes PDF. Abgelehnt bleibt
im Modell ohne Trigger.

## Considered Options

- **Kooperation-Status mitziehen**: Vertrag Gesendet würde `kooperationen.status_id`
  setzen. Die Kampagnen-Pipeline (Strategie, Sourcing, Briefing, …) ist ein anderes Modell
  und wird sich noch ändern.
- **Nur ableiten**: `getVertragStatus` aus Datei/`is_draft`. Bricht bei Gesendet/Verzögert/Abgelehnt.
- **Intern manuell Verzögert/Abgelehnt**: Dropdown in der Tabelle. Status wäre dann
  kein reines Ereignis mehr, und das Menü lag in overflow-clipped Zellen leer.
- **Resend-Opens als „Gesehen“**: Webhook ist machbar (`anschreiben_log.resend_id`), das Signal nicht.

## Decision

`vertraege.status` ist die Quelle für den Dokument-Lebenszyklus. Anschreiben bleibt ein Kernel
(`openAnschreiben` + Typ-Adapter), kein zweites Mail-Modul. Mailvorlagen haben einen Standard
pro `dokument_typ`. Open-Tracking kommt nicht. Verzögert wird aus `gesendet_am` + 30 Tage
abgeleitet und täglich persistiert; die Tabelle zeigt nur ein Badge.

## Consequences

- Migration: `vertraege.status` (Backfill aus Datei/`is_draft`), `gesendet_am` (Backfill aus
  `anschreiben_log.sent_at`), `mailvorlage.dokument_typ`, Unique-Standard pro Typ,
  Vertrag-Standardvorlage.
- Anzeige leitet Verzögert sofort ab; Daily-Function schreibt `status = verzoegert`.
- Erneutes Anschreiben setzt `gesendet_am` neu. Unterschriebenes PDF gewinnt über alles.
- Produktion zeigt den Vertrag-Status, schreibt nicht `kooperationen.status_id`.
- Nächster Dokumenttyp (Rechnung, …) = ein Client-Adapter, ein Server-Map-Eintrag, eine Standard-Vorlage.
