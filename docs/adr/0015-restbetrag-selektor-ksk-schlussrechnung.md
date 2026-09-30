# Restbetrag-Selektor zählt den KSK-Aufschlag mit und kennt eine Schlussrechnung-Markierung

ADR 0004 hat entschieden, dass der Kooperations-Selektor der Rechnungserstellung über den Restbetrag freischaltet — gebaut wurde das erst jetzt, und mit zwei Präzisierungen gegenüber dem Reporting. Fakturiert zählt im Selektor `nettobetrag + nettobetrag_steuerfrei + ksk_betrag`: Der KSK-Aufschlag steht bei Selbstzahler-Kooperationen auf der Creator-Rechnung und ist Teil der vertraglichen Vergütung — er muss den Restbetrag verbrauchen, sonst bliebe jede Selbstzahler-Kooperation rechnerisch nie vollständig fakturiert. Das Reporting (`koopFakturierung.js`) zählt fakturiert dagegen ohne KSK (Gesamtkosten-Sicht statt Abrechenbarkeits-Sicht); die beiden Formeln weichen bewusst voneinander ab. Zusatzkosten verkleinern den Restbetrag nicht — sie sind durchlaufende Posten. Zusätzlich schließt die neue Markierung `ist_schlussrechnung` eine Kooperation manuell ab: Bleibt dabei ein Restbetrag offen, gilt er als Minderabrechnung.

## Considered Options

- **Reporting-Formel unverändert übernehmen** (fakturiert ohne KSK): eine vollständig abgerechnete Selbstzahler-Kooperation bliebe mit Rest = KSK-Aufschlag für immer auswählbar.
- **Soll ohne Selbstzahler-Aufschlag, fakturiert ohne KSK**: die Ausschluss-Regel funktionierte, aber jede Rechnung mit KSK-Zeile löste eine falsche Überschreitungs-Warnung aus.
- **Fakturiert inkl. KSK, Soll wie Reporting** (gewählt): voll gestellte Selbstzahler-Kooperationen gehen sauber auf null, Warnungen stimmen.

## Consequences

- Rund 40 teilfakturierte Kooperationen (davon ~30 mit zusammen ~48.000 € offenem Restbetrag, Bestand aus ADR 0004) werden mit dem Umbau wieder abrechenbar — gewollt; die Bereinigung läuft freiwillig über die Schlussrechnung-Markierung durch Admins.
- Kooperationen ohne prüfbaren Sollbetrag (weder EK an der Kooperation noch Video-EK gepflegt) bleiben immer auswählbar — die Regel sperrt nur bei prüfbarem Soll.
- Überschreitungen warnen im Formular, blockieren nie (ADR 0004, ADR 0007).
- `vertraege.mehrere_rechnungen_erlaubt` verliert seine letzte Funktion: Checkbox im Vertrags-Wizard und Freischalt-Logik im Selektor entfallen; die Spalte bleibt als historischer Bestand.
- Das Reporting rechnet fakturiert weiterhin ohne KSK-Aufschlag — Selbstzahler-Kooperationen zeigen dort dauerhaft einen Rest in KSK-Höhe. Ob das Reporting angeglichen wird, ist eine eigene Entscheidung.
