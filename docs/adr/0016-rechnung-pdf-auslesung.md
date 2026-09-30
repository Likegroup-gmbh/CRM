# Rechnungs-PDF wird beim Upload ausgelesen und füllt das Formular vor

Die Rechnungserstellung beginnt mit dem PDF statt mit dem leeren Formular: Beim Hochladen liest Liky die Creator-Rechnung aus (gleiche Pipeline wie das Kundenbriefing) und füllt Beträge, Datum und Steuer-Felder vor; der Mitarbeiter korrigiert oder ergänzt nur noch. Die Auslesung ist Assistenz, kein Gate: Schlägt sie fehl oder ist das PDF nicht lesbar, öffnet sich das Formular mit leeren Feldern und Hinweis — speichern ist immer möglich. Die Kooperation darf das Tool nur vorschlagen (mit sichtbarer Begründung, z. B. erkannter Creator-Name), nie still vorauswählen: Die Zuordnung steuert den Restbetrag (ADR 0015) und bleibt bewusste Entscheidung. Der Kooperations-Vorschlag steht unter Evaluationsvorbehalt — wird er auf Staging als nicht intuitiv oder designstörend beurteilt, entfällt er wieder.

## Consequences

- Der PDF-Upload wandert im Anlege-Formular an den Anfang; der bisherige Fluss (Formular manuell ausfüllen, PDF optional) bleibt als Fallback erhalten.
- Felder ohne belastbare Lesung bleiben leer statt geraten; vorbefüllt werden nur leere Felder, nie manuell Eingegebenes überschrieben.
- Storno/Korrektur-Rechnungen (negative Beträge) sind ausgenommen — Korrekturen an bezahlten Rechnungen bleiben ein manueller Buchhaltungs-Prozess.
