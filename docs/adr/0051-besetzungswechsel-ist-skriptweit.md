# Besetzungs- und Geschichtenwechsel im freien Chat ist skriptweit

Ergänzt ADR 0037. Sagt der User im freien Chat „kein Mutter, ein Papa mit zwei Kindern im Auto“, änderte Liky nur eine Zelle und meldete in `antwort`, welche anderen Sektionen „nicht mehr passen“. So blieb die Mutter in der Küche in Hook und CTA stehen. Ursache war der Satz in `VERBINDLICHE_REGELN`, der für die Ein-Zellen-Aufträge gedacht ist, und ein Umfang `alles`, der nur bei „alles“, „überall“ oder einem Verbot ohne Ort ausgelöst wurde.

## Entscheidung

- Im freien Chat ist ein Wechsel von Figur, Besetzung, Ort, Setting oder Geschichte immer Umfang `alles`, auch ohne das Wort und auch bei gesetzter Markierung.
- Liky setzt ihn selbst in jeder betroffenen Zelle um: beide Spalten, Hook-Varianten, Titel. Überbleibsel des alten Stands sind ein Fehler. Das steht im `# UMFANG`-Block und in der Chat-Anweisung, nicht in `VERBINDLICHE_REGELN`; die Ein-Zellen-Buttons behalten ihr Verhalten.
- Mehrere Kritikpunkte in einer Nachricht werden alle umgesetzt. `antwort` beginnt mit „So verstehe ich dein Feedback:“ und listet sie.
- `aenderung_abgeben` bekommt `festlegungen` (Liste) neben `festlegung`, damit Besetzung und Ort beide dauerhaft gelten.
- Nach der Erstgenerierung legt `skript-generate-background` eine Feedback-Frage von Liky in den Chat. Sie ist eine normale Assistant-Message (`aktion=chat`, `status=fertig`), die Antwort läuft durch den freien Chat.

## Considered Options

- **Zweiter Prüf-Call nach dem Bundle.** Eine zweite Schleife mit denselben Kosten, in ADR 0035 abgelehnt.
- **Zusatzfeld `durchgang` im Tool-Schema.** Mehr Ausgabe ohne Beleg für Wirkung. Abgelehnt.
- **Regel in `VERBINDLICHE_REGELN` ändern.** Träfe auch Neuformulieren, Kürzen und Visual. Abgelehnt.
