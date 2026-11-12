# 0066 Teams-Meldungen über einen Workflows-Webhook je Kanal

Schreibt die Kundenseite einen Video-Kommentar, soll das zuständige Team es in Microsoft Teams sehen. Naheliegend wäre die App-Registrierung der Medienablage, die schon per Zertifikat app-only gegen Graph spricht. Graph lässt eine App ohne angemeldeten Nutzer aber nur im Migrationsmodus in Kanäle schreiben (`Teamwork.Migrate.All`, der Kanal ist währenddessen gesperrt). Entschieden: Jeder Teams-Kanal bekommt in Teams einen Workflow „Post to a channel when a webhook request is received“; das CRM speichert dessen URL und postet eine Adaptive Card hinein. Kanäle und Mitglieder pflegt das Team in Teams, das CRM kennt nur Name, URL und die abgedeckten Unternehmen.

## Entscheidung

- **Outbox statt Aufruf aus dem Browser.** Ein Trigger auf `kooperation_video_zeitkommentar` legt je passendem Kanal eine Zeile in `teams_meldung` an. Der Browser stößt nach dem Speichern `teams-meldung-senden` an (sofort), `teams-meldung-zeitplan` läuft jede Minute als Sicherheitsnetz und für Wiederholungen. Beide rufen dasselbe `verteilen()`.
- **Nur die Kundenseite** (`feedback_typ = 'kunde'`) und nur Video-Kommentare lösen aus, nicht die Feedback-Felder der Tabelle und nicht die Notizen an Stills.
- **Entfernen:** Ist die Meldung noch offen, wird sie verworfen. Ist sie raus, folgt ein Nachtrag `entfernt`, gebündelt je Kanal und Transaktion (`txid_current()`), weil das Löschen einer Datei alle ihre Kommentare in einem Rutsch entfernt.
- **Webhook-URL** ist ein Geheimnis: Tabelle nur für Admins (RLS), der Server postet nur an https-Hosts auf `*.powerplatform.com` oder `*.logic.azure.com`.

## Verworfen

- **Graph app-only mit mehr Rechten.** Posten geht nur im Migrationsmodus. Die RSC-Berechtigung `ChannelMessage.Send.Group` liefert laut offenem Microsoft-Issue (msteams-docs #14043, Stand August 2026) trotzdem 403 mit Verweis auf `Teamwork.Migrate.All`.
- **Eigener Teams-Bot.** Braucht Azure-Abo, Azure-Bot-Ressource und eine Teams-App, die ein Admin hochlädt und in jedes Team bzw. jeden geteilten Kanal einfügt. Bots posten nicht in private Kanäle (Microsoft Learn, Stand Juli 2026). Der Gewinn wäre Name und Icon statt „Flow bot“ sowie Kanäle aus dem CRM anlegen; beides war nicht gefragt.
- **Service-Account mit Nutzer-Login** (delegiert `ChannelMessage.Send`). Gespeicherter Refresh-Token, hängt an MFA und Conditional Access, postet als Person.
- **Bündeln mehrerer Kommentare** pro Video. Gewünscht ist eine Meldung je Kommentar, sofort.

## Folgen

- Der Workflow gehört einer Person. Verlässt sie das Unternehmen ohne Co-Owner, schlägt der Versand fehl; das zeigt die Admin-Seite „Teams-Kanäle“ als letzten Fehler am Kanal. Workflows antworten mit 202, das heißt angenommen, nicht zwingend gepostet.
- Staging hat eine eigene Datenbank und damit eigene Kanäle; ohne Eintrag postet dort nichts.
- Scheduled Functions laufen nur auf dem Production-Deploy. Auf Branch-Deploys verschickt nur der Anstoß aus dem Browser.
- Wechselt der Versandweg später auf einen Bot, bleiben Outbox, Trigger und Karte; nur `webhook.js` und die Spalte `webhook_url` ändern sich.
