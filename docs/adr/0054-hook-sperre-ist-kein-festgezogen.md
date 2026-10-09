# Hook-Sperre ist kein Festgezogen

Freigegebene Hooks aus dem Konzept wurden von Liky beim Überarbeiten umgeschrieben und waren danach unbrauchbar. Der gesprochene Hook einer Videoreferenz trägt deshalb eine Sperre am Konzept (`strategie_items.hook_gesperrt`). Die Generierung übernimmt den Wortlaut serverseitig 1:1 ins Skript, der Edit-Server verwirft jede Änderung an der gesprochenen Hook-Zelle und die Chat-Antwort sagt, dass der Hook vom Kunden freigegeben ist und unangetastet blieb.

## Considered Options

- **Festgezogen am Skript nutzen.** Ein Auftrag mit Umfang „alles“ oder „Hook“ öffnet Festgezogen in diesem Umfang (ADR 0037). Genau die Aufträge, die den Hook zerstören („überarbeite alles“), würden die Sperre aufheben. Abgelehnt.
- **Sperre als Feld in `beschreibung_struktur`.** „Neu analysieren“ und jede Freitext-Änderung setzen die Struktur zurück und würden das Flag mitnehmen. Abgelehnt, eigene Spalte.
- **Sperre am Skript statt am Konzept.** Der Hook entsteht und wird im Konzept freigegeben; eine Sperre erst am Skript käme nach der Generierung und ließe die erste Fassung ungeschützt. Abgelehnt.
- **Visual Hook, Text-Hook und Hook-Varianten mitsperren.** Sie sind keine freigegebene Aussage des Kunden und sollen weiter überarbeitet werden. Abgelehnt.

## Consequences

- Von Hand bleibt der Hook änderbar, auch bei gesetzter Sperre. Das Schloss sperrt nur Liky.
- Ein leerer Hook lässt sich nicht sperren. Wird die Struktur durch Freitext oder einen neuen Videolink zurückgesetzt, fällt die Sperre mit.
- „Neu analysieren“ schreibt alle Zeilen neu, behält aber den gesperrten Hook-Text.
- Eine Sperre nach der Generierung schreibt einen schon umgeschriebenen Skript-Hook nicht zurück; sie gilt für die nächste Generierung und jede spätere Überarbeitung.
- Ideen ohne Videolink haben keine Hook-Zeile und damit keine Sperre.
