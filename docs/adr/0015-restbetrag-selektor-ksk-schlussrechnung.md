# Restbetrag-Selektor rechnet reines Honorar — KSK-Selbstzahler ist ein separates Konto

ADR 0004 hat entschieden, dass der Kooperations-Selektor der Rechnungserstellung über den Restbetrag freischaltet — gebaut wurde das erst jetzt. Der Restbetrag ist reines Honorar: Soll = Video-EK-Summe, wo Videos gepflegt sind, sonst `einkaufspreis_netto` der Kooperation; fakturiert = `nettobetrag + nettobetrag_steuerfrei`. Der KSK-Selbstzahler-Aufschlag berührt den Restbetrag nicht — Entscheid Marc (30.09.2026): „Die KSK-Zahlung darf das Gesamtbudget nicht mindern." KSK-Selbstzahler sind der absolute Ausnahmefall; der Aufschlag ist ein separates Konto, dessen Summe der Selektor als `fakturiertKsk` ausweist. Zusatzkosten verkleinern den Restbetrag ebenfalls nicht — sie sind durchlaufende Posten. Zusätzlich schließt die Markierung `ist_schlussrechnung` eine Kooperation manuell ab: Bleibt dabei ein Restbetrag offen, gilt er als Minderabrechnung.

Damit der Ausnahmefall nicht zur Doppelzahlung führt (Marlies leitet die Rechnung an die Buchhaltung weiter, der Betrag würde automatisch erneut verarbeitet), ist der Selbstzahler-Aufschlag auf der Rechnung unübersehbar gekennzeichnet: Detailansicht mit Warning-Box, Listenansicht mit „Creator führt selbst ab". Abgeleitet aus `ksk_betrag > 0` — bewusst kein Pflegefeld, damit die Kennzeichnung nicht vergessen werden kann. Beim Anlegen warnen zwei weiche Hinweise: KSK auf einer Nicht-Selbstzahler-Kooperation, und KSK, die auf einer früheren Rechnung derselben Kooperation bereits abgerechnet wurde. Am KSK-Feld erinnert ein Hinweistext an das Trennungsgebot: KSK (4,9 %) darf nur auf die Creator-Leistung berechnet werden, Agenturleistung muss separat ausgewiesen sein (gilt für alle Selbstzahler, Bestätigung Esra).

Für Ausnahme-Regelungen bei Zusatzkosten (Beispiel Juniper: Programmteilnahmen laufen über das Honorar, andere Kosten derselben Kampagne bleiben Zusatzkosten) trägt der Auftrag einen Freitext-`abrechnung_hinweis`, der beim Anlegen der Rechnung eingeblendet wird. Bewusst kein Toggle: Die Ausnahme gilt pro Kostenart, nicht pro Auftrag, und Kostenarten sind im Datenmodell nicht strukturiert.

## Considered Options

- **Fakturiert inkl. KSK-Aufschlag** (ursprüngliche Annahme vor Marcs Antwort): Der Aufschlag verbraucht den Restbetrag still mit — genau das von Marc untersagte Verhalten, und das Doppelzahlungsrisiko bliebe unsichtbar.
- **Soll inkl. KSK, fakturiert ohne KSK** (alter Stand des Reportings): Selbstzahler-Kooperationen zeigen dauerhaft einen Rest in KSK-Höhe — rechnerisch nie vollständig fakturiert.
- **Reines Honorar auf beiden Seiten, KSK als separates sichtbares Konto** (gewählt): Restbetrag und Reporting decken sich, die Selbstzahler-Summe bleibt als `fakturiertKsk` und auf der Rechnung sichtbar.
- **Strukturiertes Kostenarten-Register statt Freitext-Hinweis**: präziser, aber Over-Engineering, solange die einzige bekannte Konvention (Juniper) aus einem Satz besteht.

## Consequences

- Rund 40 teilfakturierte Kooperationen (davon ~30 mit zusammen ~48.000 € offenem Restbetrag, Bestand aus ADR 0004) werden mit dem Umbau wieder abrechenbar — gewollt; die Bereinigung läuft freiwillig über die Schlussrechnung-Markierung durch Admins.
- Kooperationen ohne prüfbaren Sollbetrag (weder EK an der Kooperation noch Video-EK gepflegt) bleiben immer auswählbar — die Regel sperrt nur bei prüfbarem Soll.
- Überschreitungen und KSK-Auffälligkeiten warnen im Formular, blockieren nie (ADR 0004, ADR 0007).
- Das Reporting (`calculateKoopFakturierung`) rechnet das Soll jetzt ebenfalls ohne KSK — der frühere Dauer-Rest in KSK-Höhe bei Selbstzahler-Kooperationen löst sich auf.
- Bestandsdaten ändern sich faktisch nicht: Alle fünf Selbstzahler-Kooperationen haben `ksk_betrag = NULL`, keine Rechnung weist bisher KSK aus. Altlast „Kimberly Devlin-Mania 56/1" (20.980 € auf 20.000 € EK — KSK in die Nettosumme gebacken) bleibt überfakturiert und fällt damit aus dem Selektor.
- `vertraege.mehrere_rechnungen_erlaubt` verliert seine letzte Funktion: Checkbox im Vertrags-Wizard und Freischalt-Logik im Selektor entfallen; die Spalte bleibt als historischer Bestand.
- Marcs Idealbild „Zusatzkosten werden separat in Rechnung gestellt" ist Zukunft, kein Jetzt-Umbau — der `abrechnung_hinweis` bildet die Übergangs-Disziplin ab.
- Die Idee einer internen KSK-Schulung ist Organisationsthema, kein Code — hier nur als Kontext festgehalten.
